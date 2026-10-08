import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { STATUS_LABELS, Task, isOverdue } from '../tasks/task.models';

export interface TaskDetailData {
  task: Task;
  ownerName: string;
}

/** Read-only view of a teammate's task, opened from the Team page. */
@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title data-cy="detail-title">{{ task.title }}</h2>
    <mat-dialog-content>
      <div class="chips">
        <span class="chip priority" [attr.data-priority]="task.priority">{{ task.priority }}</span>
        <span class="chip status" [attr.data-status]="task.status" data-cy="detail-status">{{ labels[task.status] }}</span>
        @if (overdue) { <span class="chip overdue"><mat-icon>error_outline</mat-icon>Overdue</span> }
      </div>

      <h3>Description</h3>
      @if (task.description) {
        <p class="desc" data-cy="detail-description">{{ task.description }}</p>
      } @else {
        <p class="desc muted">No description.</p>
      }

      <dl>
        <dt>Owner</dt><dd data-cy="detail-owner">{{ data.ownerName }}</dd>
        <dt>Due date</dt>
        <dd [class.overdue]="overdue">{{ task.dueDate ? (task.dueDate | date: 'EEEE, MMM d, y') : 'None' }}</dd>
        <dt>Created</dt><dd>{{ task.createdAt | date: 'MMM d, y, HH:mm' }}</dd>
        <dt>Last updated</dt><dd>{{ task.updatedAt | date: 'MMM d, y, HH:mm' }}</dd>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-cy="detail-close">Close</button>
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

    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; font-size: 14px; }
    dt { color: var(--tf-muted); }
    dd { margin: 0; color: var(--tf-text); }
    dd.overdue { color: var(--tf-high); font-weight: 500; }
  `],
})
export class TaskDetailDialogComponent {
  readonly data = inject<TaskDetailData>(MAT_DIALOG_DATA);
  readonly task = this.data.task;
  readonly labels = STATUS_LABELS;
  readonly overdue = isOverdue(this.task);
}
