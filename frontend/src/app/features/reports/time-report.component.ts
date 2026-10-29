import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '../../core/api';
import { UserDirectoryService } from '../../core/user-directory.service';
import { LabelChipComponent } from '../tasks/components/label-chip.component';
import { UserSummary } from '../tasks/task.models';
import { estimateStatus, formatDuration } from '../tasks/time/time.models';
import {
  DateRange, MAX_REPORT_DAYS, REPORT_PRESETS, ReportPreset, TimeReport, hourTicks, isoDate, presetRange, rangeDays,
  shortDate,
} from './report.models';
import { ReportService } from './report.service';

/** Time logged over a period: per week, person, label and task, with the entries as a CSV download. */
@Component({
  selector: 'app-time-report',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatButtonToggleModule, MatDatepickerModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, LabelChipComponent],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Time reports</h1>
          <p>Time logged on tasks, by week, person and label. Running timers count once stopped.</p>
        </div>
        <button mat-stroked-button (click)="exportCsv()" [disabled]="!report() || exporting()" data-cy="export-csv">
          <mat-icon>download</mat-icon> Export CSV
        </button>
      </header>

      <div class="filters">
        <mat-button-toggle-group [value]="preset()" (change)="choosePreset($event.value)"
                                 hideSingleSelectionIndicator aria-label="Period">
          @for (p of presets; track p.value) {
            <mat-button-toggle [value]="p.value" [attr.data-cy]="'preset-' + p.value">{{ p.label }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dates">
          <mat-label>Custom period</mat-label>
          <mat-date-range-input [formGroup]="custom" [rangePicker]="picker">
            <input matStartDate formControlName="start" placeholder="Start" data-cy="custom-from" />
            <input matEndDate formControlName="end" placeholder="End" (dateChange)="applyCustom()" data-cy="custom-to" />
          </mat-date-range-input>
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-date-range-picker #picker />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="who">
          <mat-label>Person</mat-label>
          <!-- 0 for everyone: mat-select shows a null value as empty -->
          <mat-select [value]="userId() ?? 0" (selectionChange)="chooseUser($event.value || null)" data-cy="report-user">
            <mat-option [value]="0">Everyone</mat-option>
            @for (u of users(); track u.id) { <mat-option [value]="u.id">{{ u.fullName }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" class="loading" /> }
      @if (error()) { <p class="error" data-cy="error">{{ error() }}</p> }

      @if (report(); as r) {
        <section class="tiles" aria-label="Totals">
          <div class="tile"><span>Total time</span><strong data-cy="total">{{ duration(r.totalSeconds) }}</strong></div>
          <div class="tile"><span>Per week, on average</span><strong data-cy="average">{{ duration(weeklyAverage()) }}</strong></div>
          <div class="tile"><span>Entries</span><strong data-cy="entries">{{ r.entryCount }}</strong></div>
          <div class="tile"><span>People</span><strong data-cy="people">{{ r.byUser.length }}</strong></div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <h2>Hours per week</h2>
              <p class="muted">{{ periodText() }}</p>
            </div>
            <button mat-button (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()" data-cy="week-table-toggle">
              <mat-icon>{{ showTable() ? 'bar_chart' : 'table_rows' }}</mat-icon> {{ showTable() ? 'Chart' : 'Table' }}
            </button>
          </div>
          @if (showTable()) {
            <table class="table" data-cy="week-table">
              <thead><tr><th>Week of</th><th class="num">Time</th></tr></thead>
              <tbody>
                @for (w of r.byWeek; track w.weekStart) {
                  <tr><td>{{ date(w.weekStart) }}</td><td class="num">{{ duration(w.seconds) }}</td></tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="chart" (mouseleave)="hovered.set(null)">
              <div class="plot">
                @for (t of ticks(); track t) {
                  <div class="grid" [class.base]="t === 0" [style.bottom.%]="t / ticks()[ticks().length - 1] * 100">
                    <span>{{ t }}h</span>
                  </div>
                }
                <div class="cols" data-cy="week-chart">
                  @for (w of r.byWeek; track w.weekStart; let i = $index) {
                    <div class="col" tabindex="0" (mouseenter)="hovered.set(i)" (focus)="hovered.set(i)" (blur)="hovered.set(null)"
                         [attr.aria-label]="'Week of ' + date(w.weekStart) + ': ' + duration(w.seconds)" data-cy="week-col">
                      <div class="bar" [style.height.%]="barHeight(w.seconds)" [class.dim]="hovered() !== null && hovered() !== i">
                        @if (hovered() === i) {
                          <div class="tip" role="tooltip" data-cy="week-tip">
                            <small>Week of {{ date(w.weekStart) }}</small><strong>{{ duration(w.seconds) }}</strong>
                          </div>
                        } @else if (i === peakWeek() && w.seconds > 0 && hovered() === null) {
                          <span class="cap">{{ duration(w.seconds) }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
              <div class="xlabels">
                @for (w of r.byWeek; track w.weekStart; let i = $index) {
                  <span>{{ i % labelEvery() === 0 ? date(w.weekStart) : '' }}</span>
                }
              </div>
            </div>
          }
        </section>

        <div class="split">
          <section class="card">
            <h2>Per person</h2>
            <ul class="bars" data-cy="by-user">
              @for (u of r.byUser; track u.id) {
                <li>
                  <span class="name">{{ u.fullName }}</span>
                  <span class="track"><span class="fill" [style.width.%]="share(u.seconds, r.byUser[0].seconds)"></span></span>
                  <span class="value">{{ duration(u.seconds) }}</span>
                </li>
              } @empty { <li class="muted empty">No time logged in this period.</li> }
            </ul>
          </section>

          <section class="card">
            <h2>Per label</h2>
            <p class="muted note">A task with several labels counts for each.</p>
            <ul class="bars" data-cy="by-label">
              @for (l of r.byLabel; track l.label) {
                <li>
                  <span class="name">
                    @if (l.label) { <app-label-chip [label]="l.label" /> } @else { <em>No label</em> }
                  </span>
                  <span class="track"><span class="fill" [style.width.%]="share(l.seconds, maxLabel())"></span></span>
                  <span class="value">{{ duration(l.seconds) }}</span>
                </li>
              } @empty { <li class="muted empty">No time logged in this period.</li> }
            </ul>
          </section>
        </div>

        <section class="card">
          <h2>Tasks with the most time</h2>
          @if (r.topTasks.length) {
            <table class="table" data-cy="top-tasks">
              <thead><tr><th>Task</th><th class="num">Logged</th><th class="num">Estimate</th><th>Against the estimate</th></tr></thead>
              <tbody>
                @for (t of r.topTasks; track t.id) {
                  <tr>
                    <td>{{ t.title }}</td>
                    <td class="num">{{ duration(t.seconds) }}</td>
                    <td class="num">{{ t.estimateMinutes ? duration(t.estimateMinutes * 60) : '—' }}</td>
                    <td>
                      @if (t.estimateMinutes) {
                        @let s = status(t.seconds, t.estimateMinutes);
                        <span class="status" [class.over]="s.over">
                          <mat-icon>{{ s.over ? 'warning' : 'check_circle' }}</mat-icon>{{ s.text }}
                        </span>
                      } @else { <span class="muted">No estimate</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="muted note">Time logged in this period only.</p>
          } @else {
            <p class="muted">No time logged in this period.</p>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; --series: #2a78d6; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .head h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
    .head p, .muted { margin: 4px 0 0; color: var(--tf-muted); font-size: 14px; }
    .error { color: var(--tf-high); }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 20px; }
    .dates { width: 250px; }
    .who { width: 200px; }
    .loading { margin-bottom: 12px; }

    .card, .tile {
      background: var(--tf-surface); border: 1px solid var(--tf-border); border-radius: var(--tf-radius);
      box-shadow: var(--tf-shadow);
    }
    .card { padding: 20px; margin-bottom: 20px; }
    .card h2 { margin: 0; font-size: 16px; font-weight: 600; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .note { font-size: 12px; margin-top: 2px; }

    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
    .tile { padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
    .tile span { color: var(--tf-muted); font-size: 13px; }
    .tile strong { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }

    .chart { padding-left: 36px; }
    .plot { position: relative; height: 200px; margin-top: 18px; }
    .grid { position: absolute; left: 0; right: 0; border-top: 1px solid #eceef3; }
    .grid.base { border-top-color: #cfd3dc; }
    .grid span {
      position: absolute; right: 100%; margin-right: 8px; transform: translateY(-50%);
      font-size: 11px; color: var(--tf-muted); font-variant-numeric: tabular-nums;
    }
    .cols { position: absolute; inset: 0; display: flex; }
    .col {
      flex: 1; min-width: 0; position: relative; display: flex; align-items: flex-end; justify-content: center;
      outline: none; cursor: default;
    }
    .col:focus-visible { background: var(--tf-accent-soft); border-radius: 6px; }
    .bar {
      position: relative; width: 60%; max-width: 24px; min-height: 0; background: var(--series);
      border-radius: 4px 4px 0 0; transition: opacity .12s;
    }
    .bar.dim { opacity: .45; }
    .cap {
      position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 4px;
      font-size: 12px; font-weight: 600; color: var(--tf-text); white-space: nowrap;
    }
    .tip {
      position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 2;
      display: flex; flex-direction: column; padding: 6px 10px; border-radius: 8px; white-space: nowrap;
      background: var(--tf-text); color: #fff; font-size: 12px; pointer-events: none;
    }
    .tip small { opacity: .75; }
    .xlabels { display: flex; margin-top: 6px; }
    .xlabels span { flex: 1; min-width: 0; text-align: center; font-size: 11px; color: var(--tf-muted); white-space: nowrap; overflow: visible; }

    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .bars { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .bars li { display: grid; grid-template-columns: 130px 1fr 64px; align-items: center; gap: 10px; font-size: 14px; }
    .bars li.empty { display: block; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .name em { font-style: normal; color: var(--tf-muted); }
    .track { height: 12px; }
    .fill { display: block; height: 100%; min-width: 2px; background: var(--series); border-radius: 0 4px 4px 0; }
    .value { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

    .table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px; }
    .table th { text-align: left; font-size: 12px; font-weight: 600; color: var(--tf-muted); padding: 6px 8px; border-bottom: 1px solid var(--tf-border); }
    .table td { padding: 8px; border-bottom: 1px solid #f1f2f6; }
    .table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .status { display: inline-flex; align-items: center; gap: 4px; color: var(--tf-done); }
    .status.over { color: var(--tf-high); }
    .status mat-icon { font-size: 16px; width: 16px; height: 16px; }

    @media (max-width: 760px) {
      .tiles { grid-template-columns: repeat(2, 1fr); }
      .split { grid-template-columns: 1fr; }
      .page { padding: 24px 16px; }
      .head { flex-direction: column; }
    }
  `],
})
export class TimeReportComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly directory = inject(UserDirectoryService);
  private readonly snackBar = inject(MatSnackBar);
  /** The report being loaded, cancelled when the filters change again before it arrives. */
  private request?: Subscription;

  readonly presets = REPORT_PRESETS;
  readonly duration = formatDuration;
  readonly date = shortDate;
  readonly status = estimateStatus;

  readonly preset = signal<ReportPreset | null>('LAST_4_WEEKS');
  readonly range = signal<DateRange>(presetRange('LAST_4_WEEKS', new Date()));
  readonly userId = signal<number | null>(null);
  readonly users = signal<UserSummary[]>([]);
  readonly report = signal<TimeReport | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly showTable = signal(false);
  /** Index of the week under the pointer or keyboard focus. */
  readonly hovered = signal<number | null>(null);

  readonly custom = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  readonly ticks = computed(() => hourTicks(Math.max(0, ...(this.report()?.byWeek.map((w) => w.seconds) ?? [0]))));
  readonly peakWeek = computed(() => {
    const weeks = this.report()?.byWeek ?? [];
    return weeks.reduce((best, w, i) => (w.seconds > weeks[best].seconds ? i : best), 0);
  });
  /** With many weeks, only every n-th gets its date under the axis. */
  readonly labelEvery = computed(() => Math.max(1, Math.ceil((this.report()?.byWeek.length ?? 0) / 8)));
  readonly weeklyAverage = computed(() => {
    const r = this.report();
    return r && r.byWeek.length ? r.totalSeconds / r.byWeek.length : 0;
  });
  readonly maxLabel = computed(() => Math.max(0, ...(this.report()?.byLabel.map((l) => l.seconds) ?? [0])));
  readonly periodText = computed(() => {
    const r = this.report();
    return r ? `${shortDate(r.from)} – ${shortDate(r.to)}` : '';
  });

  ngOnInit(): void {
    this.directory.users().subscribe({
      next: (users) => this.users.set([...users].sort((a, b) => a.fullName.localeCompare(b.fullName))),
      // the report still works for everyone without the list
      error: () => this.users.set([]),
    });
    this.load();
  }

  choosePreset(preset: ReportPreset): void {
    this.preset.set(preset);
    this.range.set(presetRange(preset, new Date()));
    this.custom.reset();
    this.load();
  }

  applyCustom(): void {
    const { start, end } = this.custom.value;
    if (!start || !end) return;
    this.preset.set(null);
    this.range.set({ from: start, to: end });
    this.load();
  }

  chooseUser(id: number | null): void {
    this.userId.set(id);
    this.load();
  }

  barHeight(seconds: number): number {
    const top = this.ticks()[this.ticks().length - 1] * 3600;
    return (seconds / top) * 100;
  }

  share(seconds: number, max: number): number {
    return max ? (seconds / max) * 100 : 0;
  }

  exportCsv(): void {
    const range = this.range();
    this.exporting.set(true);
    this.reports.csv(range, this.userId()).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `time-${isoDate(range.from)}-to-${isoDate(range.to)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.exporting.set(false);
        this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 });
      },
    });
  }

  private load(): void {
    const range = this.range();
    this.request?.unsubscribe();
    if (rangeDays(range) > MAX_REPORT_DAYS) {
      this.error.set(`Pick a period of at most ${MAX_REPORT_DAYS} days.`);
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    this.request = this.reports.get(range, this.userId()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
