import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { errorMessage } from '../../core/api';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { TaskCardComponent } from '../tasks/components/task-card.component';
import { STATUS_LABELS, TASK_STATUSES, Task, TaskFilter } from '../tasks/task.models';
import { TaskOwner, TeamService } from './team.service';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [RouterLink, MatButtonToggleModule, MatIconModule, MatProgressBarModule, TaskCardComponent],
  template: `
    <div class="page">
      <header class="head">
        <h1>Team</h1>
        <p>Everyone who has created tasks. Select a person to see their tasks.</p>
      </header>

      @if (error()) { <p class="error" data-cy="error">{{ error() }}</p> }

      <div class="layout">
        <aside class="owners" data-cy="owners">
          @for (owner of owners(); track owner.id) {
            <a class="owner" [routerLink]="['/team', owner.id]" [class.active]="owner.id === selectedId()"
               data-cy="owner">
              <span class="avatar" aria-hidden="true">{{ initials(owner.fullName) }}</span>
              <span class="who">
                <strong>{{ owner.fullName }}@if (owner.id === me()?.id) { <em>(you)</em> }</strong>
                <small>{{ owner.email }}</small>
              </span>
              <span class="count" [attr.aria-label]="owner.total + ' tasks'" data-cy="owner-count">{{ owner.total }}</span>
            </a>
          } @empty {
            @if (!loadingOwners()) { <p class="muted">No one has created a task yet.</p> }
          }
        </aside>

        <section class="tasks">
          @if (selected(); as owner) {
            <div class="tasks-head">
              <div>
                <h2 data-cy="selected-owner">{{ owner.fullName }}</h2>
                <p class="muted">{{ owner.todo }} to do · {{ owner.inProgress }} in progress · {{ owner.done }} done</p>
              </div>
              <mat-button-toggle-group [value]="filter()" (change)="filter.set($event.value)"
                                       hideSingleSelectionIndicator aria-label="Filter">
                <mat-button-toggle value="ALL" data-cy="team-filter-ALL">All</mat-button-toggle>
                @for (s of statuses; track s) {
                  <mat-button-toggle [value]="s" [attr.data-cy]="'team-filter-' + s">{{ labels[s] }}</mat-button-toggle>
                }
              </mat-button-toggle-group>
            </div>
            @if (loadingTasks()) { <mat-progress-bar mode="indeterminate" class="loading" /> }
            <div class="grid">
              @for (task of visibleTasks(); track task.id) {
                <app-task-card [task]="task" [readonly]="true" />
              } @empty {
                @if (!loadingTasks()) { <p class="empty muted" data-cy="empty">No tasks here.</p> }
              }
            </div>
          } @else {
            <div class="placeholder">
              <mat-icon>group</mat-icon>
              <p class="muted">@if (selectedId() !== null && !loadingOwners()) { This user has no tasks. } @else { Pick someone on the left. }</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
    .head { margin-bottom: 24px; }
    .head h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
    .head p, .muted { margin: 4px 0 0; color: var(--tf-muted); font-size: 14px; }
    .error { color: var(--tf-high); }

    .layout { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
    .owners {
      display: flex; flex-direction: column; padding: 8px; gap: 2px;
      background: var(--tf-surface); border: 1px solid var(--tf-border); border-radius: var(--tf-radius);
      box-shadow: var(--tf-shadow);
    }
    .owner {
      display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px;
      color: var(--tf-text); text-decoration: none;
    }
    .owner:hover { background: #f1f2f6; }
    .owner.active { background: var(--tf-accent-soft); }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
      background: var(--tf-accent-soft); color: var(--tf-accent); font-size: 13px; font-weight: 700;
    }
    .owner.active .avatar { background: var(--tf-accent); color: #fff; }
    .who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .who strong { font-size: 14px; font-weight: 600; }
    .who em { font-style: normal; font-weight: 400; color: var(--tf-muted); margin-left: 4px; }
    .who small { color: var(--tf-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count {
      min-width: 24px; padding: 2px 8px; box-sizing: border-box; border-radius: 99px; text-align: center;
      background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600;
    }

    .tasks-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .tasks-head h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .loading { margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .empty { grid-column: 1 / -1; }
    .placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 240px;
      border: 1px dashed var(--tf-border); border-radius: var(--tf-radius); color: var(--tf-muted);
    }
    .placeholder mat-icon { font-size: 36px; width: 36px; height: 36px; }

    @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .page { padding: 24px 16px; } }
  `],
})
export class TeamComponent implements OnInit {
  private readonly team = inject(TeamService);
  readonly me = inject(Store).selectSignal(authFeature.selectUser);

  readonly statuses = TASK_STATUSES;
  readonly labels = STATUS_LABELS;

  readonly owners = signal<TaskOwner[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly filter = signal<TaskFilter>('ALL');
  readonly loadingOwners = signal(true);
  readonly loadingTasks = signal(false);
  readonly error = signal<string | null>(null);

  readonly selected = computed(() => this.owners().find((o) => o.id === this.selectedId()) ?? null);
  readonly visibleTasks = computed(() => {
    const f = this.filter();
    return f === 'ALL' ? this.tasks() : this.tasks().filter((t) => t.status === f);
  });

  /** Bound from the `team/:userId` route parameter. */
  @Input()
  set userId(value: string | undefined) {
    const id = value ? Number(value) : null;
    this.selectedId.set(id);
    this.error.set(null);
    this.filter.set('ALL');
    this.tasks.set([]);
    if (id !== null) this.loadTasks(id);
  }

  ngOnInit(): void {
    this.team.getOwners().subscribe({
      next: (owners) => {
        this.owners.set(owners);
        this.loadingOwners.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loadingOwners.set(false);
      },
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  private loadTasks(id: number): void {
    this.loadingTasks.set(true);
    this.team.getTasks(id).subscribe({
      next: (tasks) => {
        if (this.selectedId() === id) this.tasks.set(tasks);
        this.loadingTasks.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loadingTasks.set(false);
      },
    });
  }
}
