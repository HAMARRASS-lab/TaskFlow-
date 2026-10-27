import { Component, Input, OnChanges, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { errorMessage } from '../../../core/api';
import {
  MAX_ESTIMATE_MINUTES, MAX_LOGGED_MINUTES, TimeSummary, estimateStatus, formatClock, formatDuration, parseDuration,
} from './time.models';
import { TimeService } from './time.service';

/**
 * Time tracking of a task: the time logged on it against its estimate, a start/stop timer and a form to log time by
 * hand, then every entry. Shown in the task dialogs; read-only unless the user owns or is assigned the task.
 */
@Component({
  selector: 'app-task-time',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <section class="time" data-cy="time">
      <h3>Time tracking</h3>

      @if (summary(); as s) {
        <div class="totals">
          <div>
            <span class="big" data-cy="time-logged">{{ fmt(totalSeconds()) }}</span>
            <span class="muted">logged</span>
          </div>
          <div class="estimate">
            <span class="muted">Estimate</span>
            @if (s.canLog) {
              <input #estimate class="inline" [value]="s.estimateMinutes ? fmt(s.estimateMinutes * 60) : ''"
                     placeholder="e.g. 3h" aria-label="Estimate" [disabled]="busy()"
                     (keydown.enter)="$event.preventDefault(); estimate.blur()"
                     (blur)="saveEstimate(estimate.value)" data-cy="time-estimate" />
            } @else {
              <strong data-cy="time-estimate">{{ s.estimateMinutes ? fmt(s.estimateMinutes * 60) : 'none' }}</strong>
            }
          </div>
        </div>

        @if (progress(); as p) {
          <div class="bar" [class.over]="p.over" role="progressbar" [attr.aria-valuenow]="p.percent"
               aria-valuemin="0" aria-valuemax="100">
            <span [style.width.%]="p.percent > 100 ? 100 : p.percent"></span>
          </div>
          <p class="progress-text" [class.over]="p.over" data-cy="time-progress">
            {{ p.percent }}% of the estimate · {{ p.text }}
          </p>
        }

        @if (s.canLog) {
          <div class="actions">
            @if (myTimer()) {
              <button mat-flat-button type="button" class="stop" (click)="stop()" [disabled]="busy()"
                      data-cy="time-stop">
                <mat-icon>stop</mat-icon> Stop · {{ clock(liveSeconds(myTimer()!)) }}
              </button>
            } @else {
              <button mat-stroked-button type="button" (click)="start()" [disabled]="busy()" data-cy="time-start">
                <mat-icon>play_arrow</mat-icon> Start timer
              </button>
            }
            <div class="log">
              <input #duration class="field short" placeholder="1h 30m" aria-label="Time spent" [disabled]="busy()"
                     (keydown.enter)="$event.preventDefault(); log(duration, note)" data-cy="time-duration" />
              <input #note class="field" placeholder="Note (optional)" maxlength="200" aria-label="Note"
                     [disabled]="busy()" (keydown.enter)="$event.preventDefault(); log(duration, note)"
                     data-cy="time-note" />
              <button mat-button type="button" (click)="log(duration, note)" [disabled]="busy()" data-cy="time-log">
                Log
              </button>
            </div>
          </div>
        }

        @if (error()) { <p class="error-text" data-cy="time-error">{{ error() }}</p> }

        @if (s.entries.length) {
          <ul class="entries">
            @for (e of s.entries; track e.id) {
              <li data-cy="time-entry">
                <span class="who">{{ e.user?.fullName ?? 'A former user' }}</span>
                @if (e.running) {
                  <span class="running" data-cy="time-running"><span class="pulse"></span>{{ clock(liveSeconds(e)) }}</span>
                } @else {
                  <span class="dur">{{ fmt(e.seconds) }}</span>
                }
                @if (e.note) { <span class="note">{{ e.note }}</span> }
                <time [attr.datetime]="e.startedAt">{{ e.startedAt | date: 'MMM d, HH:mm' }}</time>
                @if (e.mine) {
                  <button mat-icon-button type="button" class="remove" (click)="remove(e.id)" [disabled]="busy()"
                          [matTooltip]="e.running ? 'Discard timer' : 'Delete'" aria-label="Delete entry"
                          data-cy="time-delete">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="muted" data-cy="no-time">No time logged yet.</p>
        }
      } @else if (loading()) {
        <p class="muted">Loading time…</p>
      } @else {
        <p class="error-text" data-cy="time-error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [`
    .time { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--tf-border); }
    h3 {
      margin: 0 0 12px; line-height: 20px; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted);
    }
    .muted { margin: 0; color: var(--tf-muted); font-size: 13px; }
    .totals { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .big { font-size: 22px; font-weight: 600; margin-right: 6px; color: var(--tf-text); font-variant-numeric: tabular-nums; }
    .estimate { display: flex; align-items: baseline; gap: 6px; font-size: 14px; }
    .inline {
      width: 80px; border: 0; border-bottom: 1px dashed var(--tf-border); background: transparent; font: inherit;
      font-weight: 600; color: var(--tf-text); padding: 2px 0; outline: none; text-align: right;
    }
    .inline:focus { border-bottom: 1px solid var(--tf-accent); }
    .bar { height: 6px; margin-top: 10px; border-radius: 99px; background: var(--tf-accent-soft); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--tf-accent); transition: width .3s; }
    .bar.over span { background: var(--tf-high); }
    .progress-text { margin: 6px 0 0; font-size: 12px; color: var(--tf-muted); }
    .progress-text.over { color: var(--tf-high); font-weight: 500; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 14px; }
    .stop { --mdc-filled-button-container-color: var(--tf-high); font-variant-numeric: tabular-nums; }
    .log { display: flex; flex: 1; min-width: 240px; align-items: center; gap: 6px; }
    .field {
      flex: 1; min-width: 0; border: 1px solid var(--tf-border); border-radius: 8px; padding: 7px 10px;
      font: inherit; font-size: 13px; color: var(--tf-text); background: var(--tf-surface); outline: none;
    }
    .field:focus { border-color: var(--tf-accent); }
    .field.short { flex: 0 0 84px; }
    .entries { margin: 12px 0 0; padding: 0; list-style: none; }
    li {
      display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 13px; color: var(--tf-text);
      border-bottom: 1px solid var(--tf-border);
    }
    li:last-child { border-bottom: 0; }
    .who { font-weight: 600; }
    .dur, .running { font-variant-numeric: tabular-nums; }
    .running { display: inline-flex; align-items: center; gap: 6px; color: var(--tf-high); font-weight: 600; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--tf-high); animation: pulse 1.2s infinite; }
    @keyframes pulse { 50% { opacity: .3; } }
    .note { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tf-muted); }
    time { margin-left: auto; color: var(--tf-muted); font-size: 12px; white-space: nowrap; }
    .remove { --mdc-icon-button-state-layer-size: 28px; padding: 2px; color: #9aa0b1; }
    .remove mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .error-text { margin: 8px 0 0; color: var(--tf-high); font-size: 13px; }
  `],
})
export class TaskTimeComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) taskId!: number;

  private readonly service = inject(TimeService);

  readonly summary = signal<TimeSummary | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  /** Seconds since the summary was loaded, added to running timers so they tick. */
  private readonly elapsed = signal(0);
  private loadedAt = 0;
  private ticker?: ReturnType<typeof setInterval>;

  readonly myTimer = computed(() => this.summary()?.entries.find((e) => e.running && e.mine) ?? null);
  /** Finished entries plus the running timers so far. */
  readonly totalSeconds = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    return s.loggedSeconds + s.entries.filter((e) => e.running).reduce((sum, e) => sum + this.liveSeconds(e), 0);
  });
  readonly progress = computed(() => {
    const estimate = this.summary()?.estimateMinutes;
    return estimate ? estimateStatus(this.totalSeconds(), estimate) : null;
  });

  readonly fmt = formatDuration;
  readonly clock = formatClock;

  ngOnChanges(): void {
    this.run(this.service.get(this.taskId), () => this.loading.set(false));
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }

  liveSeconds(e: { seconds: number; running: boolean }): number {
    return e.running ? e.seconds + this.elapsed() : e.seconds;
  }

  start(): void {
    this.run(this.service.start(this.taskId));
  }

  stop(): void {
    this.run(this.service.stop(this.taskId));
  }

  remove(entryId: number): void {
    this.run(this.service.delete(this.taskId, entryId));
  }

  log(duration: HTMLInputElement, note: HTMLInputElement): void {
    const minutes = parseDuration(duration.value);
    if (minutes === null || minutes > MAX_LOGGED_MINUTES) {
      this.error.set(duration.value.trim()
        ? 'Enter the time spent like 45m, 1h 30m or 1.5 (hours), up to 24h'
        : 'Enter the time spent, e.g. 1h 30m');
      return;
    }
    this.run(this.service.log(this.taskId, minutes, note.value.trim() || null), () => {
      duration.value = '';
      note.value = '';
    });
  }

  saveEstimate(text: string): void {
    const current = this.summary()?.estimateMinutes ?? null;
    const minutes = text.trim() ? parseDuration(text) : null;
    if (text.trim() && (minutes === null || minutes > MAX_ESTIMATE_MINUTES)) {
      this.error.set('Enter the estimate like 3h, 2h 30m or 90m');
      return;
    }
    if (minutes === current) return;
    this.run(this.service.setEstimate(this.taskId, minutes));
  }

  private run(call: Observable<TimeSummary>, done?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.error.set(null);
        this.busy.set(false);
        this.restartTicker(summary);
        done?.();
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
        this.loading.set(false);
      },
    });
  }

  private restartTicker(summary: TimeSummary): void {
    clearInterval(this.ticker);
    this.ticker = undefined;
    this.loadedAt = Date.now();
    this.elapsed.set(0);
    if (summary.entries.some((e) => e.running)) {
      this.ticker = setInterval(() => this.elapsed.set(Math.floor((Date.now() - this.loadedAt) / 1000)), 1000);
    }
  }
}
