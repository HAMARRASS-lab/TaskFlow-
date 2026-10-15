import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '../../core/api';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { TaskCommentsComponent } from '../tasks/comments/task-comments.component';
import { LabelChipComponent } from '../tasks/components/label-chip.component';
import { TaskService } from '../tasks/task.service';
import { STATUS_LABELS, Task, checklistProgress, isOverdue, isWatching } from '../tasks/task.models';

export interface TaskDetailData {
  task: Task;
  ownerName: string;
  /** Admins only: users the task's ownership can be transferred to. The dialog then closes with the chosen user id. */
  assignees?: { id: number; fullName: string }[];
  ownerId?: number;
}

/** Read-only view of a teammate's task, opened from the Team page: anyone can watch it, admins can transfer it. */
@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [DatePipe, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, TaskCommentsComponent, LabelChipComponent],
  template: `
    <h2 mat-dialog-title data-cy="detail-title">{{ task().title }}</h2>
    <mat-dialog-content>
      <div class="chips">
        <span class="chip priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        <span class="chip status" [attr.data-status]="task().status" data-cy="detail-status">{{ labels[task().status] }}</span>
        @if (overdue) { <span class="chip overdue"><mat-icon>error_outline</mat-icon>Overdue</span> }
        @for (l of task().labels; track l) { <app-label-chip [label]="l" /> }
      </div>

      <h3>Description</h3>
      @if (task().description) {
        <p class="desc" data-cy="detail-description">{{ task().description }}</p>
      } @else {
        <p class="desc muted">No description.</p>
      }

      @if (task().checklist.length) {
        <h3>Checklist · {{ progress.done }}/{{ progress.total }}</h3>
        <ul class="checklist" data-cy="detail-checklist">
          @for (item of task().checklist; track item.id) {
            <li [class.done]="item.done">
              <mat-icon>{{ item.done ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>{{ item.title }}
            </li>
          }
        </ul>
      }

      <dl>
        <dt>Owner</dt><dd data-cy="detail-owner">{{ data.ownerName }}</dd>
        <dt>Assignee</dt><dd data-cy="detail-assigned-to">{{ task().assignee?.fullName ?? 'Unassigned' }}</dd>
        <dt>Watchers</dt><dd data-cy="detail-watchers">{{ watcherNames() || 'None' }}</dd>
        <dt>Due date</dt>
        <dd [class.overdue]="overdue">{{ task().dueDate ? (task().dueDate | date: 'EEEE, MMM d, y') : 'None' }}</dd>
        <dt>Created</dt><dd>{{ task().createdAt | date: 'MMM d, y, HH:mm' }}</dd>
        <dt>Last updated</dt><dd>{{ task().updatedAt | date: 'MMM d, y, HH:mm' }}</dd>
      </dl>

      <app-task-comments [taskId]="task().id" />

      @if (data.assignees; as assignees) {
        <mat-form-field appearance="outline" class="assign" subscriptSizing="dynamic">
          <mat-label>Transfer ownership to</mat-label>
          <mat-select [(ngModel)]="assigneeId" data-cy="detail-assignee">
            @for (u of assignees; track u.id) { <mat-option [value]="u.id">{{ u.fullName }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="toggleWatch()" [disabled]="busy()" data-cy="detail-watch">
        <mat-icon>{{ watching() ? 'visibility_off' : 'visibility' }}</mat-icon>
        {{ watching() ? 'Stop watching' : 'Watch' }}
      </button>
      <span class="spacer"></span>
      <button mat-button mat-dialog-close data-cy="detail-close">Close</button>
      @if (data.assignees) {
        <button mat-flat-button color="primary" [disabled]="!assigneeId || assigneeId === data.ownerId"
                (click)="reassign()" data-cy="detail-reassign">Transfer</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px;
      font-size: 12px; font-weight: 600;
    }
    .chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .priority[data-priority='HIGH'] { color: var(--tf-high); background: #fee2e2; }
    .priority[data-priority='MEDIUM'] { color: #b45309; background: #fef3c7; }
    .priority[data-priority='LOW'] { color: #047857; background: #d1fae5; }
    .status[data-status='TODO'] { background: #f1f5f9; color: #475569; }
    .status[data-status='IN_PROGRESS'] { background: #fef3c7; color: #b45309; }
    .status[data-status='DONE'] { background: #d1fae5; color: #047857; }
    .chip.overdue { color: var(--tf-high); background: #fee2e2; }

    h3 { margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted); }
    .desc { margin: 0 0 20px; white-space: pre-wrap; word-break: break-word; line-height: 1.55; color: var(--tf-text); }
    .desc.muted { color: var(--tf-muted); }

    .checklist { list-style: none; margin: 0 0 20px; padding: 0; font-size: 14px; }
    .checklist li { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    .checklist mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--tf-muted); flex: none; }
    .checklist li.done { color: var(--tf-muted); text-decoration: line-through; }
    .checklist li.done mat-icon { color: var(--tf-done); }

    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; font-size: 14px; }
    dt { color: var(--tf-muted); }
    dd { margin: 0; color: var(--tf-text); }
    dd.overdue { color: var(--tf-high); font-weight: 500; }
    .assign { width: 100%; margin-top: 20px; }
    .spacer { flex: 1; }
  `],
})
export class TaskDetailDialogComponent {
  readonly data = inject<TaskDetailData>(MAT_DIALOG_DATA);
  /** Updated when the user starts or stops watching it. */
  readonly task = signal<Task>(this.data.task);
  readonly labels = STATUS_LABELS;
  readonly overdue = isOverdue(this.data.task);
  readonly progress = checklistProgress(this.data.task);
  private readonly me = toSignal(inject(Store).select(authFeature.selectUser), { initialValue: null });
  readonly watching = computed(() => isWatching(this.task(), this.me()?.id));
  readonly watcherNames = computed(() => this.task().watchers.map((w) => w.fullName).join(', '));
  readonly busy = signal(false);
  private readonly tasks = inject(TaskService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<TaskDetailDialogComponent, number>, { optional: true });
  assigneeId = this.data.ownerId;

  toggleWatch(): void {
    this.busy.set(true);
    this.tasks.setWatching(this.task().id, !this.watching()).subscribe({
      next: (task) => {
        this.task.set(task);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 });
      },
    });
  }

  reassign(): void {
    if (this.assigneeId && this.assigneeId !== this.data.ownerId) this.dialogRef?.close(this.assigneeId);
  }
}
