const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date as `YYYY-MM-DDTHH:mm:ss` in local time (what the API expects for LocalDateTime). */
export function toLocalDateTime(date: Date): string {
  return `${toDayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** `YYYY-MM-DD` key of a local Date, used to group events by day. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses an API local date-time (or date) string as a local Date. */
export function parseLocal(value: string): Date {
  return new Date(value.length === 10 ? value + 'T00:00:00' : value);
}

/** `HH:mm` of a Date. */
export function toTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines a day and an `HH:mm` string into a local Date. */
export function atTime(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDayKey(a) === toDayKey(b);
}

/**
 * The 6 weeks (42 days) displayed for a month, weeks starting on Monday.
 * Always 6 rows so the grid height stays stable when navigating.
 */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
