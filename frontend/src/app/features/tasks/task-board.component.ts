import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
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
  imports: [AsyncPipe, DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, TaskCardComponent],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>My tasks</h1>
          <p>{{ today | date: 'EEEE, MMMM d' }}</p>
        </div>
        <button mat-flat-button color="primary" class="new" (click)="openForm()" data-cy="new-task">
          <mat-icon>add</mat-icon> New task
        </button>
      </header>

      @if (stats$ | async; as stats) {
        <section class="stats">
          <div class="stat">
            <span class="icon total"><mat-icon>inventory_2</mat-icon></span>
            <div><strong>{{ stats.total }}</strong><span>Total</span></div>
          </div>
          <div class="stat">
            <span class="icon todo"><mat-icon>radio_button_unchecked</mat-icon></span>
            <div><strong data-cy="stat-todo">{{ stats.todo }}</strong><span>To do</span></div>
          </div>
          <div class="stat">
            <span class="icon progress"><mat-icon>autorenew</mat-icon></span>
            <div><strong data-cy="stat-progress">{{ stats.inProgress }}</strong><span>In progress</span></div>
          </div>
          <div class="stat">
            <span class="icon done"><mat-icon>check_circle</mat-icon></span>
            <div><strong data-cy="stat-done">{{ stats.done }}</strong><span>Done</span></div>
          </div>
        </section>
        @if (stats.total) {
          <div class="completion">
            <div class="completion-label">
              <span>Overall progress</span>
              <strong>{{ percent(stats.done, stats.total) }}%</strong>
            </div>
            <div class="track"><div class="fill" [style.width.%]="percent(stats.done, stats.total)"></div></div>
          </div>
        }
      }

      <div class="toolbar">
        <mat-button-toggle-group [value]="filter$ | async" (change)="setFilter($event.value)"
                                 hideSingleSelectionIndicator aria-label="Filter">
          <mat-button-toggle value="ALL" data-cy="filter-ALL">All</mat-button-toggle>
          @for (s of statuses; track s) {
            <mat-button-toggle [value]="s" [attr.data-cy]="'filter-' + s">{{ labels[s] }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>

      @if (loading$ | async) { <mat-progress-bar mode="indeterminate" class="loading" /> }

      <div class="grid">
        @for (task of tasks$ | async; track task.id) {
          <app-task-card [task]="task"
                         (statusChange)="changeStatus(task.id, $event)"
                         (edit)="openForm($event)"
                         (remove)="remove($event)" />
        } @empty {
          <div class="empty" data-cy="empty">
            <span class="empty-icon"><mat-icon>checklist</mat-icon></span>
            <h3>No tasks here yet</h3>
            <p>Create a task to get started.</p>
            <button mat-stroked-button (click)="openForm()"><mat-icon>add</mat-icon> New task</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .head h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
    .head p { margin: 4px 0 0; color: var(--tf-muted); font-size: 14px; }
    .new { height: 42px; padding: 0 18px; }

    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
    .stat {
      display: flex; align-items: center; gap: 14px; padding: 16px 18px;
      background: var(--tf-surface); border: 1px solid var(--tf-border);
      border-radius: var(--tf-radius); box-shadow: var(--tf-shadow);
    }
    .stat div { display: flex; flex-direction: column; }
    .stat strong { font-size: 26px; font-weight: 700; line-height: 1.1; }
    .stat div span { color: var(--tf-muted); font-size: 13px; }
    .icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; flex: none; }
    .icon.total { background: var(--tf-accent-soft); color: var(--tf-accent); }
    .icon.todo { background: #f1f5f9; color: var(--tf-todo); }
    .icon.progress { background: #fef3c7; color: var(--tf-progress); }
    .icon.done { background: #d1fae5; color: var(--tf-done); }

    .completion {
      background: var(--tf-surface); border: 1px solid var(--tf-border); border-radius: var(--tf-radius);
      padding: 14px 18px; margin-bottom: 24px; box-shadow: var(--tf-shadow);
    }
    .completion-label { display: flex; justify-content: space-between; font-size: 13px; color: var(--tf-muted); margin-bottom: 8px; }
    .completion-label strong { color: var(--tf-text); }
    .track { height: 8px; border-radius: 99px; background: #eef0f4; overflow: hidden; }
    .fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #6366f1, #10b981); transition: width .4s ease; }

    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .toolbar mat-button-toggle-group { background: var(--tf-surface); border-color: var(--tf-border); }
    .loading { margin-bottom: 12px; border-radius: 99px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
    .empty {
      grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--tf-muted);
      background: var(--tf-surface); border: 1px dashed var(--tf-border); border-radius: var(--tf-radius);
    }
    .empty-icon {
      width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 12px; display: grid; place-items: center;
      background: var(--tf-accent-soft); color: var(--tf-accent);
    }
    .empty h3 { margin: 0 0 4px; color: var(--tf-text); font-size: 16px; font-weight: 600; }
    .empty p { margin: 0 0 16px; font-size: 14px; }

    @media (max-width: 720px) { .stats { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 420px) {
      .grid { grid-template-columns: 1fr; }
      .head h1 { font-size: 24px; }
    }
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
  readonly today = new Date();

  ngOnInit(): void {
    this.store.dispatch(TasksActions.load());
  }

  percent(part: number, total: number): number {
    return total ? Math.round((part / total) * 100) : 0;
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
