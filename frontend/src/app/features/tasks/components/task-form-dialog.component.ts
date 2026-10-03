import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, Task, TaskPriority, TaskRequest, TaskStatus } from '../task.models';

/** Formats a Date as YYYY-MM-DD in local time (what the API expects for LocalDate). */
export function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  selector: 'app-task-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit task' : 'New task' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" cdkFocusInitial data-cy="task-title" />
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
        </mat-form-field>
        <div class="row">
          <mat-form-field>
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              @for (s of statuses; track s) { <mat-option [value]="s">{{ labels[s] }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              @for (p of priorities; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field class="full-width">
          <mat-label>Due date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="dueDate" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" data-cy="task-save">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.row { display: flex; gap: 12px; } .row mat-form-field { flex: 1; }`],
})
export class TaskFormDialogComponent {
  readonly data = inject<Task | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<TaskFormDialogComponent, TaskRequest>);

  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;
  readonly labels = STATUS_LABELS;

  readonly form = inject(FormBuilder).group({
    title: [this.data?.title ?? '', [Validators.required, Validators.maxLength(200)]],
    description: [this.data?.description ?? ''],
    status: [this.data?.status ?? ('TODO' as TaskStatus), Validators.required],
    priority: [this.data?.priority ?? ('MEDIUM' as TaskPriority), Validators.required],
    dueDate: [this.data?.dueDate ? new Date(this.data.dueDate + 'T00:00:00') : (null as Date | null)],
  });

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      title: v.title!.trim(),
      description: v.description || null,
      status: v.status!,
      priority: v.priority!,
      dueDate: toIsoDate(v.dueDate),
    });
  }
}
