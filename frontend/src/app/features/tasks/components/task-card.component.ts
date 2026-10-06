import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { STATUS_LABELS, TASK_STATUSES, Task, TaskStatus } from '../task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatSelectModule],
  template: `
    <article class="card" [class.done]="task.status === 'DONE'" [attr.data-priority]="task.priority" data-cy="task-card">
      <div class="top">
        <span class="priority" [attr.data-priority]="task.priority">{{ task.priority }}</span>
        @if (task.dueDate) {
          <span class="due" [class.overdue]="isOverdue">
            <mat-icon>{{ isOverdue ? 'error_outline' : 'event' }}</mat-icon>
            {{ task.dueDate | date: 'MMM d' }}
          </span>
        }
        <span class="spacer"></span>
        @if (!readonly) {
          <button mat-icon-button class="icon-btn" (click)="edit.emit(task)" aria-label="Edit" data-cy="edit-task">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button class="icon-btn delete" (click)="remove.emit(task.id)" aria-label="Delete" data-cy="delete-task">
            <mat-icon>delete_outline</mat-icon>
          </button>
        }
      </div>
      <h3 class="title">{{ task.title }}</h3>
      @if (task.description) { <p class="desc">{{ task.description }}</p> }
      <div class="bottom">
        @if (readonly) {
          <span class="status static" [attr.data-status]="task.status" data-cy="task-status">{{ labels[task.status] }}</span>
        } @else {
        <mat-select class="status" [attr.data-status]="task.status" [value]="task.status"
                    (selectionChange)="statusChange.emit($event.value)" aria-label="Status" data-cy="status-select"
                    panelWidth="">
          @for (s of statuses; track s) { <mat-option [value]="s">{{ labels[s] }}</mat-option> }
        </mat-select>
        }
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .card {
      position: relative; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
      padding: 14px 14px 14px 20px; overflow: hidden;
      background: var(--tf-surface); border: 1px solid var(--tf-border); border-radius: var(--tf-radius);
      box-shadow: var(--tf-shadow); transition: box-shadow .2s ease, transform .2s ease;
    }
    .card:hover { box-shadow: var(--tf-shadow-hover); transform: translateY(-1px); }
    .card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--stripe); }
    .card[data-priority='HIGH'] { --stripe: var(--tf-high); }
    .card[data-priority='MEDIUM'] { --stripe: var(--tf-medium); }
    .card[data-priority='LOW'] { --stripe: var(--tf-low); }

    .top { display: flex; align-items: center; gap: 8px; margin: -4px -6px 6px 0; }
    .priority {
      font-size: 11px; font-weight: 600; letter-spacing: .04em; padding: 3px 8px; border-radius: 99px;
    }
    .priority[data-priority='HIGH'] { color: var(--tf-high); background: #fee2e2; }
    .priority[data-priority='MEDIUM'] { color: #b45309; background: #fef3c7; }
    .priority[data-priority='LOW'] { color: #047857; background: #d1fae5; }
    .due { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--tf-muted); }
    .due mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .due.overdue { color: var(--tf-high); font-weight: 500; }
    .icon-btn { --mdc-icon-button-state-layer-size: 34px; padding: 5px; color: #9aa0b1; }
    .icon-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .icon-btn:hover { color: var(--tf-text); }
    .icon-btn.delete:hover { color: var(--tf-high); }

    .title { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.35; word-break: break-word; }
    .desc {
      margin: 6px 0 0; color: var(--tf-muted); font-size: 14px; line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .card.done .title { text-decoration: line-through; color: var(--tf-muted); }
    .card.done { background: #fbfcfd; }

    .bottom { margin-top: auto; padding-top: 14px; display: flex; }
    .status {
      width: auto; min-width: 128px; padding: 6px 12px; border-radius: 99px; font-size: 13px; font-weight: 500;
      --mat-select-enabled-trigger-text-color: currentColor; --mat-select-enabled-arrow-color: currentColor;
    }
    .status.static { min-width: 0; }
    .status[data-status='TODO'] { background: #f1f5f9; color: #475569; }
    .status[data-status='IN_PROGRESS'] { background: #fef3c7; color: #b45309; }
    .status[data-status='DONE'] { background: #d1fae5; color: #047857; }
  `],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  /** Hides edit/delete and shows the status as a label (viewing someone else's tasks). */
  @Input() readonly = false;
  @Output() statusChange = new EventEmitter<TaskStatus>();
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<number>();

  readonly statuses = TASK_STATUSES;
  readonly labels = STATUS_LABELS;

  get isOverdue(): boolean {
    if (!this.task.dueDate || this.task.status === 'DONE') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(this.task.dueDate + 'T00:00:00') < today;
  }
}
