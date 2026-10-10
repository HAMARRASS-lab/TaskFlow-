import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TASK_PRIORITIES } from '../task.models';
import { DUE_FILTER_LABELS, DueFilter, SORT_LABELS, TaskQuery, TaskSort, isQueryActive } from '../task-query';

/** Search box + priority / due date / sort selects, shared by the board and the Team page. */
@Component({
  selector: 'app-task-query-bar',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="bar">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput type="search" placeholder="Search tasks" aria-label="Search tasks"
               [value]="query.search" (input)="patch({ search: $any($event.target).value })" data-cy="task-search" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-select [value]="query.priority" (selectionChange)="patch({ priority: $event.value })"
                    aria-label="Priority" data-cy="priority-filter">
          <mat-option value="ALL">Any priority</mat-option>
          @for (p of priorities; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-select [value]="query.due" (selectionChange)="patch({ due: $event.value })"
                    aria-label="Due date" data-cy="due-filter">
          @for (d of dueFilters; track d) { <mat-option [value]="d">{{ dueLabels[d] }}</mat-option> }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-icon matPrefix>sort</mat-icon>
        <mat-select [value]="query.sort" (selectionChange)="patch({ sort: $event.value })"
                    aria-label="Sort by" data-cy="task-sort">
          @for (s of sorts; track s) { <mat-option [value]="s">{{ sortLabels[s] }}</mat-option> }
        </mat-select>
      </mat-form-field>

      @if (active) {
        <button mat-button (click)="reset.emit()" data-cy="clear-filters">
          <mat-icon>filter_alt_off</mat-icon> Clear
        </button>
      }
    </div>
  `,
  styles: [`
    .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .bar mat-form-field { width: 170px; --mat-form-field-container-height: 42px;
      --mat-form-field-container-vertical-padding: 9px; --mdc-outlined-text-field-container-shape: 10px; }
    .bar mat-form-field.search { flex: 1 1 220px; min-width: 200px; }
    .bar mat-icon[matPrefix] { padding: 0 4px 0 10px; color: var(--tf-muted); }
    @media (max-width: 520px) { .bar mat-form-field { flex: 1 1 140px; width: auto; } }
  `],
})
export class TaskQueryBarComponent {
  @Input({ required: true }) query!: TaskQuery;
  @Output() queryChange = new EventEmitter<Partial<TaskQuery>>();
  @Output() reset = new EventEmitter<void>();

  readonly priorities = TASK_PRIORITIES;
  readonly dueFilters = Object.keys(DUE_FILTER_LABELS) as DueFilter[];
  readonly dueLabels = DUE_FILTER_LABELS;
  readonly sorts = Object.keys(SORT_LABELS) as TaskSort[];
  readonly sortLabels = SORT_LABELS;

  get active(): boolean {
    return isQueryActive(this.query);
  }

  patch(change: Partial<TaskQuery>): void {
    this.queryChange.emit(change);
  }
}
