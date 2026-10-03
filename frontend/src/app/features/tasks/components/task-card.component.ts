import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { STATUS_LABELS, TASK_STATUSES, Task, TaskStatus } from '../task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatChipsModule],
  template: `
    <mat-card class="card" [class.done]="task.status === 'DONE'" data-cy="task-card">
      <mat-card-header>
        <mat-card-title>{{ task.title }}</mat-card-title>
        <mat-card-subtitle>
          <span class="priority" [attr.data-priority]="task.priority">{{ task.priority }}</span>
          @if (task.dueDate) { · due {{ task.dueDate | date: 'mediumDate' }} }
        </mat-card-subtitle>
      </mat-card-header>
      @if (task.description) {
        <mat-card-content><p>{{ task.description }}</p></mat-card-content>
      }
      <mat-card-actions>
        <mat-select class="status" [value]="task.status" (selectionChange)="statusChange.emit($event.value)"
                    aria-label="Status" data-cy="status-select">
          @for (s of statuses; track s) { <mat-option [value]="s">{{ labels[s] }}</mat-option> }
        </mat-select>
        <span class="spacer"></span>
        <button mat-icon-button (click)="edit.emit(task)" aria-label="Edit" data-cy="edit-task">
          <mat-icon>edit</mat-icon>
        </button>
        <button mat-icon-button (click)="remove.emit(task.id)" aria-label="Delete" data-cy="delete-task">
          <mat-icon>delete</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .card { margin-bottom: 12px; }
    .card.done mat-card-title { text-decoration: line-through; opacity: .6; }
    mat-card-actions { display: flex; align-items: center; padding: 0 16px 8px; }
    .status { width: 140px; }
    .priority { font-weight: 500; }
    .priority[data-priority='HIGH'] { color: #b3261e; }
    .priority[data-priority='MEDIUM'] { color: #b26a00; }
    .priority[data-priority='LOW'] { color: #2e7d32; }
  `],
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  @Output() statusChange = new EventEmitter<TaskStatus>();
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<number>();

  readonly statuses = TASK_STATUSES;
  readonly labels = STATUS_LABELS;
}
