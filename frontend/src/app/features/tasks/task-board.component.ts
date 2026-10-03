import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { TaskCardComponent } from './components/task-card.component';
import { TaskFormDialogComponent } from './components/task-form-dialog.component';
import { STATUS_LABELS, TASK_STATUSES, Task, TaskFilter, TaskRequest, TaskStatus } from './task.models';
import { TasksActions } from './store/tasks.actions';
import { tasksFeature } from './store/tasks.reducer';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [AsyncPipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, TaskCardComponent],
  template: `
    <div class="page">
      @if (stats$ | async; as stats) {
        <section class="stats">
          <div class="stat"><strong>{{ stats.total }}</strong><span>Total</span></div>
          <div class="stat"><strong data-cy="stat-todo">{{ stats.todo }}</strong><span>To do</span></div>
          <div class="stat"><strong data-cy="stat-progress">{{ stats.inProgress }}</strong><span>In progress</span></div>
          <div class="stat"><strong data-cy="stat-done">{{ stats.done }}</strong><span>Done</span></div>
        </section>
      }

      <div class="toolbar">
        <mat-button-toggle-group [value]="filter$ | async" (change)="setFilter($event.value)" aria-label="Filter">
          <mat-button-toggle value="ALL" data-cy="filter-ALL">All</mat-button-toggle>
          @for (s of statuses; track s) {
            <mat-button-toggle [value]="s" [attr.data-cy]="'filter-' + s">{{ labels[s] }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" (click)="openForm()" data-cy="new-task">
          <mat-icon>add</mat-icon> New task
        </button>
      </div>

      @if (loading$ | async) { <mat-progress-bar mode="indeterminate" /> }

      @for (task of tasks$ | async; track task.id) {
        <app-task-card [task]="task"
                       (statusChange)="changeStatus(task.id, $event)"
                       (edit)="openForm($event)"
                       (remove)="remove($event)" />
      } @empty {
        <p class="empty" data-cy="empty">No tasks here yet.</p>
      }
    </div>
  `,
  styles: [`
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat { background: #fff; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; }
    .stat strong { font-size: 28px; }
    .stat span { color: #666; font-size: 13px; }
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .empty { text-align: center; color: #777; padding: 32px; }
    @media (max-width: 600px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class TaskBoardComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly tasks$ = this.store.select(tasksFeature.selectFilteredTasks);
  readonly stats$ = this.store.select(tasksFeature.selectStats);
  readonly filter$ = this.store.select(tasksFeature.selectFilter);
  readonly loading$ = this.store.select(tasksFeature.selectLoading);

  readonly statuses = TASK_STATUSES;
  readonly labels = STATUS_LABELS;

  ngOnInit(): void {
    this.store.dispatch(TasksActions.load());
  }

  setFilter(filter: TaskFilter): void {
    this.store.dispatch(TasksActions.setFilter({ filter }));
  }

  changeStatus(id: number, status: TaskStatus): void {
    this.store.dispatch(TasksActions.changeStatus({ id, status }));
  }

  remove(id: number): void {
    this.store.dispatch(TasksActions.delete({ id }));
  }

  openForm(task?: Task): void {
    this.dialog
      .open<TaskFormDialogComponent, Task | null, TaskRequest>(TaskFormDialogComponent, { data: task ?? null, width: '520px' })
      .afterClosed()
      .pipe(filter((request): request is TaskRequest => !!request))
      .subscribe((request) =>
        this.store.dispatch(task ? TasksActions.update({ id: task.id, request }) : TasksActions.create({ request })),
      );
  }
}
