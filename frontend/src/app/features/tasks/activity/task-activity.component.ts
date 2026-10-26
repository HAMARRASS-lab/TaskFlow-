import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { errorMessage } from '../../../core/api';
import { EVENT_ICONS, TaskEvent, describeEvent } from './activity.models';
import { ActivityService } from './activity.service';

/** How many of the latest events show before "Show earlier activity". */
export const RECENT_EVENTS = 5;

/**
 * Activity history of a task as a timeline, oldest first: its creation, then who changed its status, priority,
 * assignee or due date, and when. Shown with the comments in the task dialogs.
 */
@Component({
  selector: 'app-task-activity',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule],
  template: `
    <section class="activity" data-cy="activity">
      <h3>Activity</h3>

      @if (loading()) {
        <p class="muted">Loading activity…</p>
      } @else if (error()) {
        <p class="error-text" data-cy="activity-error">{{ error() }}</p>
      } @else if (!events().length) {
        <p class="muted" data-cy="no-activity">No activity yet.</p>
      } @else {
        @if (hidden() > 0) {
          <button mat-button type="button" class="earlier" (click)="expanded.set(true)" data-cy="activity-earlier">
            Show {{ hidden() }} earlier {{ hidden() === 1 ? 'change' : 'changes' }}
          </button>
        }
        <ol class="timeline">
          @for (e of shown(); track e.id) {
            <li data-cy="activity-event">
              <span class="dot" aria-hidden="true"><mat-icon>{{ e.icon }}</mat-icon></span>
              <p>
                <strong>{{ e.actor?.fullName ?? 'A former user' }}</strong> {{ e.text }}
                <time [attr.datetime]="e.createdAt">{{ e.createdAt | date: 'MMM d, y, HH:mm' }}</time>
              </p>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    .activity { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--tf-border); }
    h3 {
      margin: 0 0 12px; line-height: 20px; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted);
    }
    .muted { margin: 0; color: var(--tf-muted); font-size: 14px; }
    .earlier { margin: 0 0 8px -8px; font-size: 13px; }
    .timeline { margin: 0; padding: 0; list-style: none; }
    li { position: relative; display: flex; gap: 10px; padding-bottom: 12px; }
    li:not(:last-child)::before {
      content: ''; position: absolute; left: 11px; top: 24px; bottom: 0; width: 2px; background: var(--tf-border);
    }
    .dot {
      flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
      background: var(--tf-accent-soft); color: var(--tf-accent);
    }
    .dot mat-icon { font-size: 14px; width: 14px; height: 14px; }
    p { margin: 2px 0 0; font-size: 13px; line-height: 1.45; color: var(--tf-text); }
    strong { font-weight: 600; }
    time { margin-left: 6px; color: var(--tf-muted); font-size: 12px; white-space: nowrap; }
    .error-text { margin: 0; color: var(--tf-high); font-size: 13px; }
  `],
})
export class TaskActivityComponent implements OnChanges {
  @Input({ required: true }) taskId!: number;
  /** Changes when the task does (its `updatedAt`), to reload the history after an edit made in the same dialog. */
  @Input() version?: string;

  private readonly service = inject(ActivityService);

  readonly events = signal<TaskEvent[]>([]);
  readonly expanded = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** The events not shown until "Show earlier" is clicked. */
  readonly hidden = computed(() => (this.expanded() ? 0 : Math.max(0, this.events().length - RECENT_EVENTS)));
  readonly shown = computed(() =>
    this.events()
      .slice(this.hidden())
      .map((e) => ({ ...e, icon: EVENT_ICONS[e.type], text: describeEvent(e) })),
  );

  ngOnChanges(): void {
    this.service.getAll(this.taskId).subscribe({
      next: (events) => {
        this.events.set(events);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
