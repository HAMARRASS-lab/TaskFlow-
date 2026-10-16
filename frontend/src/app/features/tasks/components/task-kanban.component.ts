import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { STATUS_LABELS, Task, TaskStatus, canDeleteTask, canEditTask } from '../task.models';
import { ChecklistToggle, TaskCardComponent } from './task-card.component';

export interface KanbanColumn {
  status: TaskStatus;
  tasks: Task[];
}

export interface StatusMove {
  task: Task;
  status: TaskStatus;
}

/** To do / In progress / Done columns; dropping a card on another column moves it to that status. */
@Component({
  selector: 'app-task-kanban',
  standalone: true,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, TaskCardComponent],
  template: `
    <div class="kanban" cdkDropListGroup data-cy="kanban">
      @for (column of columns; track column.status) {
        <section class="column" [attr.data-status]="column.status" [attr.data-cy]="'column-' + column.status">
          <header class="column-head">
            <span class="dot"></span>
            <h2>{{ labels[column.status] }}</h2>
            <span class="count" data-cy="column-count">{{ column.tasks.length }}</span>
          </header>
          <div class="drop" cdkDropList [cdkDropListData]="column.status" (cdkDropListDropped)="drop($event)"
               [attr.aria-label]="labels[column.status] + ' column'">
            @for (task of column.tasks; track task.id) {
              <app-task-card cdkDrag [cdkDragData]="task" [cdkDragDisabled]="!canEdit(task)"
                             [class.draggable]="canEdit(task)" [task]="task"
                             [readonly]="!canEdit(task)" [canDelete]="canDelete(task)" [canUnwatch]="true"
                             (statusChange)="move.emit({ task, status: $event })"
                             (checklistToggle)="checklistToggle.emit({ task, toggle: $event })"
                             (edit)="edit.emit($event)"
                             (remove)="remove.emit($event)"
                             (unwatch)="unwatch.emit($event)">
                <div *cdkDragPlaceholder class="placeholder"></div>
              </app-task-card>
            } @empty {
              <p class="column-empty">{{ filtered ? 'No matching tasks' : 'Drop tasks here' }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .kanban { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .column {
      display: flex; flex-direction: column; min-width: 0; padding: 12px; border-radius: var(--tf-radius);
      background: #eef0f5; border: 1px solid var(--tf-border);
    }
    .column[data-status='TODO'] { --dot: var(--tf-todo); }
    .column[data-status='IN_PROGRESS'] { --dot: var(--tf-progress); }
    .column[data-status='DONE'] { --dot: var(--tf-done); }
    .column-head { display: flex; align-items: center; gap: 8px; padding: 2px 4px 12px; }
    .column-head h2 { margin: 0; font-size: 14px; font-weight: 600; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dot); }
    .count {
      margin-left: auto; min-width: 22px; padding: 2px 7px; border-radius: 99px; text-align: center;
      background: var(--tf-surface); color: var(--tf-muted); font-size: 12px; font-weight: 600;
    }
    .drop { display: flex; flex-direction: column; gap: 10px; min-height: 120px; border-radius: 10px; }
    .drop.cdk-drop-list-receiving { background: rgba(79, 70, 229, .06); outline: 2px dashed rgba(79, 70, 229, .35); outline-offset: 2px; }
    .draggable { cursor: grab; }
    .draggable:active { cursor: grabbing; }
    .cdk-drag-preview { box-shadow: 0 12px 28px rgba(16, 24, 40, .18); border-radius: var(--tf-radius); transform: rotate(1.5deg); }
    .cdk-drag-animating, .drop.cdk-drop-list-dragging .draggable:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, .2, 1);
    }
    .placeholder {
      min-height: 72px; border-radius: var(--tf-radius); border: 2px dashed rgba(79, 70, 229, .4);
      background: rgba(79, 70, 229, .05);
    }
    .column-empty {
      margin: 0; padding: 36px 8px; text-align: center; color: var(--tf-muted); font-size: 13px;
      border: 1px dashed #cfd3df; border-radius: 10px;
    }
    @media (max-width: 900px) { .kanban { grid-template-columns: 1fr; } }
  `],
})
export class TaskKanbanComponent {
  @Input({ required: true }) columns!: KanbanColumn[];
  /** Search/filters are active: empty columns say "no matching tasks" rather than inviting a drop. */
  @Input() filtered = false;
  /** The signed-in user: cards they can't change (watched tasks) are read-only and can't be dragged. */
  @Input() meId: number | null = null;
  @Output() move = new EventEmitter<StatusMove>();
  @Output() checklistToggle = new EventEmitter<{ task: Task; toggle: ChecklistToggle }>();
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<number>();
  @Output() unwatch = new EventEmitter<number>();

  readonly labels = STATUS_LABELS;

  canEdit(task: Task): boolean {
    return canEditTask(task, this.meId);
  }

  canDelete(task: Task): boolean {
    return canDeleteTask(task, this.meId);
  }

  /** Reordering within a column isn't stored, so only cross-column drops do anything. */
  drop(event: CdkDragDrop<TaskStatus, TaskStatus, Task>): void {
    if (event.previousContainer !== event.container) this.move.emit({ task: event.item.data, status: event.container.data });
  }
}
