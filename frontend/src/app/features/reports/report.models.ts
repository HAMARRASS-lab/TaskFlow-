/** Time logged between `from` and `to` (both included, `YYYY-MM-DD`); running timers count once stopped. */
export interface TimeReport {
  from: string;
  to: string;
  /** Only this user's time, or everyone's when `null`. */
  userId: number | null;
  totalSeconds: number;
  entryCount: number;
  /** The most time first; `id` is `null` for users who have since been deleted. */
  byUser: { id: number | null; fullName: string; seconds: number }[];
  /** The most time first, `label: null` (no label) last. A task with several labels counts for each. */
  byLabel: { label: string | null; seconds: number }[];
  /** Every week of the period, oldest first, `weekStart` being its Monday. */
  byWeek: { weekStart: string; seconds: number }[];
  /** The ten tasks with the most time. */
  topTasks: { id: number; title: string; estimateMinutes: number | null; seconds: number }[];
}

export type ReportPreset = 'WEEK' | 'LAST_4_WEEKS' | 'MONTH' | 'LAST_3_MONTHS';

export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
  { value: 'WEEK', label: 'This week' },
  { value: 'LAST_4_WEEKS', label: 'Last 4 weeks' },
  { value: 'MONTH', label: 'This month' },
  { value: 'LAST_3_MONTHS', label: 'Last 3 months' },
];

/** Longest period a report can cover (matches the API). */
export const MAX_REPORT_DAYS = 366;

export interface DateRange {
  from: Date;
  to: Date;
}

/** A local date as `YYYY-MM-DD` (not `toISOString()`, which would shift it to UTC). */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` as a local date. */
export function parseIsoDate(text: string): Date {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** The period a preset covers, up to `today`. Weeks start on Monday, as in the report. */
export function presetRange(preset: ReportPreset, today: Date): DateRange {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (preset) {
    case 'WEEK':
      return { from: monday(to), to };
    case 'LAST_4_WEEKS': {
      const from = monday(to);
      from.setDate(from.getDate() - 21);
      return { from, to };
    }
    case 'MONTH':
      return { from: new Date(to.getFullYear(), to.getMonth(), 1), to };
    case 'LAST_3_MONTHS':
      return { from: new Date(to.getFullYear(), to.getMonth() - 2, 1), to };
  }
}

/** Days covered by the range, both ends included. */
export function rangeDays(range: DateRange): number {
  return Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1;
}

/** "2026-10-05" → "Oct 5". */
export function shortDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Hour gridlines for a chart whose tallest value is `maxSeconds`: 0 up to a round top, in at most 4 steps of
 * 1, 2 or 5 × 10ⁿ hours. 0 → [0, 1].
 */
export function hourTicks(maxSeconds: number): number[] {
  const maxHours = maxSeconds / 3600;
  let step = 1;
  for (let i = 0; maxHours > step * 4; i++) {
    step = [2, 5, 10][i % 3] * 10 ** Math.floor(i / 3);
  }
  const top = Math.max(step, Math.ceil(maxHours / step) * step);
  const ticks: number[] = [];
  for (let h = 0; h <= top; h += step) ticks.push(h);
  return ticks;
}
