import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { catchError, of } from 'rxjs';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { authFeature } from '../../../core/auth/store/auth.reducer';
import { UserDirectoryService } from '../../../core/user-directory.service';
import { TaskCommentsComponent } from '../comments/task-comments.component';
import {
  MAX_CHECKLIST_ITEMS, MAX_LABEL_LENGTH, MAX_LABELS, MAX_WATCHERS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, Task,
  TaskPriority, TaskRequest, TaskStatus, UserSummary, labelColor, normalizeLabel,
} from '../task.models';
import { UserAvatarComponent } from './user-avatar.component';

/** Formats a Date as YYYY-MM-DD in local time (what the API expects for LocalDate). */
export function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface TaskFormData {
  /** The task to edit, or null to create one. */
  task: Task | null;
  /** Labels already in use, suggested while typing. */
  labels: string[];
}

@Component({
  selector: 'app-task-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatAutocompleteModule, MatCheckboxModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatButtonModule,
    TaskCommentsComponent, UserAvatarComponent],
  template: `
    <h2 mat-dialog-title>{{ task ? 'Edit task' : 'New task' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" cdkFocusInitial data-cy="task-title" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabels[s] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              @for (p of priorities; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Due date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="dueDate" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Assignee</mat-label>
            <mat-select formControlName="assigneeId" data-cy="task-assignee-select">
              <mat-select-trigger>{{ nameOf(form.controls.assigneeId.value) }}</mat-select-trigger>
              <mat-option [value]="null"><span class="muted">Unassigned</span></mat-option>
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id">
                  <span class="person">
                    <app-user-avatar [user]="u" [size]="24" [tooltip]="null" />
                    <span class="who">
                      <span>{{ u.fullName }} @if (u.id === meId()) { <span class="muted">(you)</span> }</span>
                      <span class="email">{{ u.email }}</span>
                    </span>
                  </span>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Watchers</mat-label>
            <mat-select formControlName="watcherIds" multiple data-cy="task-watchers-select">
              <mat-select-trigger>{{ namesOf(form.controls.watcherIds.value) }}</mat-select-trigger>
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id" [disabled]="watcherLimitReached(u.id)">
                  <span class="person">
                    <app-user-avatar [user]="u" [size]="24" [tooltip]="null" />
                    <span class="who">
                      <span>{{ u.fullName }} @if (u.id === meId()) { <span class="muted">(you)</span> }</span>
                      <span class="email">{{ u.email }}</span>
                    </span>
                  </span>
                </mat-option>
              }
            </mat-select>
            <mat-hint>They see the task on their board</mat-hint>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Labels</mat-label>
          <mat-chip-grid #chipGrid aria-label="Labels">
            @for (l of labels(); track l) {
              <mat-chip-row (removed)="removeLabel(l)" [style.--mdc-chip-elevated-container-color]="color(l).background"
                            [style.--mdc-chip-label-text-color]="color(l).color"
                            [style.--mdc-chip-with-trailing-icon-trailing-icon-color]="color(l).color"
                            data-cy="label-chip-row">
                {{ l }}
                <button matChipRemove [attr.aria-label]="'Remove ' + l"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input [placeholder]="labels().length >= maxLabels ? '' : 'bug, frontend, urgent…'"
                   [formControl]="labelInput" [matChipInputFor]="chipGrid" [matAutocomplete]="labelAuto"
                   [matChipInputSeparatorKeyCodes]="separators" (matChipInputTokenEnd)="addLabel($event)"
                   [maxlength]="maxLabelLength" [readonly]="labels().length >= maxLabels" data-cy="label-input" />
          </mat-chip-grid>
          <mat-autocomplete #labelAuto (optionSelected)="selectLabel($event)">
            @for (l of suggestions(); track l) { <mat-option [value]="l">{{ l }}</mat-option> }
          </mat-autocomplete>
          <mat-hint>Press Enter or comma to add · up to {{ maxLabels }}</mat-hint>
        </mat-form-field>

        <section class="checklist" formArrayName="checklist">
          <h3>
            Checklist
            @if (checklist.length) { <span class="muted">{{ doneCount() }}/{{ checklist.length }}</span> }
          </h3>
          @for (item of checklist.controls; track item; let i = $index) {
            <div class="item" [formGroupName]="i" data-cy="checklist-row">
              <mat-checkbox formControlName="done" [attr.aria-label]="'Done: ' + item.value.title" />
              <input class="item-title" formControlName="title" maxlength="200" aria-label="Checklist item"
                     [class.checked]="item.value.done" />
              <button mat-icon-button type="button" class="remove" (click)="removeItem(i)" aria-label="Remove item">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          @if (checklist.length < maxItems) {
            <div class="item add">
              <mat-icon>add</mat-icon>
              <input class="item-title" [formControl]="newItem" maxlength="200" placeholder="Add an item"
                     (keydown.enter)="$event.preventDefault(); addItem()" (blur)="addItem()"
                     data-cy="checklist-new" />
            </div>
          }
        </section>

        @if (task) { <app-task-comments [taskId]="task.id" /> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" data-cy="task-save">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .row { display: flex; gap: 12px; } .row mat-form-field { flex: 1; min-width: 0; }
    .person { display: inline-flex; align-items: center; gap: 10px; }
    /* the email tells apart people with the same name */
    .who { display: flex; flex-direction: column; line-height: 1.25; }
    .email { font-size: 12px; color: var(--tf-muted); }
    .checklist { margin: 4px 0 16px; }
    .checklist h3 { display: flex; gap: 8px; align-items: baseline; margin: 0 0 6px; font-size: 14px; font-weight: 600; }
    .muted { color: var(--tf-muted); font-weight: 400; font-size: 13px; }
    .item { display: flex; align-items: center; gap: 2px; border-radius: 8px; }
    .item:hover { background: #f6f7fb; }
    .item-title {
      flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 14px; padding: 8px 4px;
      color: var(--tf-text); outline: none; border-bottom: 1px solid transparent;
    }
    .item-title:focus { border-bottom-color: var(--tf-accent); }
    .item-title.checked { text-decoration: line-through; color: var(--tf-muted); }
    .item.add { padding-left: 10px; color: var(--tf-muted); }
    .item.add mat-icon { font-size: 20px; width: 20px; height: 20px; margin-right: 8px; }
    .remove { --mdc-icon-button-state-layer-size: 32px; padding: 4px; color: #9aa0b1; }
    .remove mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class TaskFormDialogComponent {
  readonly data = inject<TaskFormData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly task = this.data?.task ?? null;
  private readonly dialogRef = inject(MatDialogRef<TaskFormDialogComponent, TaskRequest>);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly directory = inject(UserDirectoryService);

  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;
  readonly statusLabels = STATUS_LABELS;
  readonly separators = [ENTER, COMMA] as const;
  readonly maxLabels = MAX_LABELS;
  readonly maxLabelLength = MAX_LABEL_LENGTH;
  readonly maxItems = MAX_CHECKLIST_ITEMS;

  readonly form = this.fb.group({
    title: [this.task?.title ?? '', [Validators.required, Validators.maxLength(200)]],
    description: [this.task?.description ?? ''],
    status: [this.task?.status ?? ('TODO' as TaskStatus), Validators.required],
    priority: [this.task?.priority ?? ('MEDIUM' as TaskPriority), Validators.required],
    dueDate: [this.task?.dueDate ? new Date(this.task.dueDate + 'T00:00:00') : (null as Date | null)],
    assigneeId: [this.task?.assignee?.id ?? (null as number | null)],
    watcherIds: [this.task?.watchers.map((w) => w.id) ?? ([] as number[])],
    checklist: this.fb.array((this.task?.checklist ?? []).map((i) => this.itemGroup(i.title, i.done, i.id))),
  });

  readonly labels = signal<string[]>([...(this.task?.labels ?? [])]);
  /** Every user, plus the task's current people in case the directory can't be loaded. */
  readonly users = toSignal(
    this.directory.users().pipe(catchError(() => of(this.currentPeople()))),
    { initialValue: this.currentPeople() },
  );
  private readonly me = toSignal(inject(Store).select(authFeature.selectUser), { initialValue: null });
  readonly meId = computed(() => this.me()?.id ?? null);
  readonly labelInput = new FormControl('', { nonNullable: true });
  readonly newItem = new FormControl('', { nonNullable: true });
  private readonly labelQuery = signal('');
  private readonly checklistValue = signal(this.form.controls.checklist.getRawValue());

  readonly suggestions = computed(() => {
    const q = normalizeLabel(this.labelQuery());
    return (this.data?.labels ?? []).filter((l) => !this.labels().includes(l) && l.includes(q));
  });
  readonly doneCount = computed(() => this.checklistValue().filter((i) => i.done).length);

  constructor() {
    this.labelInput.valueChanges.subscribe((v) => this.labelQuery.set(v));
    this.form.controls.checklist.valueChanges.subscribe(() =>
      this.checklistValue.set(this.form.controls.checklist.getRawValue()),
    );
  }

  nameOf(id: number | null): string {
    return id === null ? 'Unassigned' : (this.users().find((u) => u.id === id)?.fullName ?? '');
  }

  namesOf(ids: number[]): string {
    return this.users().filter((u) => ids.includes(u.id)).map((u) => u.fullName).join(', ');
  }

  watcherLimitReached(id: number): boolean {
    const ids = this.form.controls.watcherIds.value;
    return ids.length >= MAX_WATCHERS && !ids.includes(id);
  }

  private currentPeople(): UserSummary[] {
    const people = [this.task?.assignee, ...(this.task?.watchers ?? [])].filter((u): u is UserSummary => !!u);
    return [...new Map(people.map((u) => [u.id, u])).values()];
  }

  get checklist() {
    return this.form.controls.checklist;
  }

  color(label: string) {
    return labelColor(label);
  }

  addLabel(event: MatChipInputEvent): void {
    this.pushLabel(event.value);
    event.chipInput.clear();
  }

  selectLabel(event: MatAutocompleteSelectedEvent): void {
    this.pushLabel(event.option.value);
  }

  removeLabel(label: string): void {
    this.labels.update((ls) => ls.filter((l) => l !== label));
  }

  private pushLabel(raw: string): void {
    const label = normalizeLabel(raw).slice(0, MAX_LABEL_LENGTH);
    this.labelInput.setValue('');
    if (!label || this.labels().includes(label) || this.labels().length >= MAX_LABELS) return;
    this.labels.update((ls) => [...ls, label]);
  }

  addItem(): void {
    const title = this.newItem.value.trim();
    if (!title || this.checklist.length >= MAX_CHECKLIST_ITEMS) return;
    this.checklist.push(this.itemGroup(title, false, null));
    this.newItem.setValue('');
  }

  removeItem(index: number): void {
    this.checklist.removeAt(index);
  }

  save(): void {
    // Text still in the label / new-item inputs counts, so nothing typed is silently lost.
    this.pushLabel(this.labelInput.value);
    this.addItem();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      title: v.title.trim(),
      description: v.description || null,
      status: v.status,
      priority: v.priority,
      dueDate: toIsoDate(v.dueDate),
      labels: this.labels(),
      checklist: v.checklist.map((i) => ({ id: i.id, title: i.title.trim(), done: i.done })),
      assigneeId: v.assigneeId,
      watcherIds: v.watcherIds,
    });
  }

  private itemGroup(title: string, done: boolean, id: number | null) {
    return this.fb.group({
      id: [id as number | null],
      title: [title, [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
      done: [done],
    });
  }
}
