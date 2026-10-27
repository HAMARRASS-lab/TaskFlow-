/** Time spent on a task: a timer (`running` until stopped) or a duration logged by hand. */
export interface TimeEntry {
  id: number;
  /** `null` when the user who logged the time has since been deleted. */
  user: { id: number; fullName: string } | null;
  startedAt: string;
  endedAt: string | null;
  /** For a running timer, the time elapsed when the server answered. */
  seconds: number;
  running: boolean;
  /** Logged by the current user, who can delete it (or stop it while it runs). */
  mine: boolean;
  note: string | null;
}

export interface TimeSummary {
  estimateMinutes: number | null;
  /** Finished entries only. */
  loggedSeconds: number;
  /** The current user may start a timer, log time and set the estimate (the task's owner or assignee). */
  canLog: boolean;
  /** Newest first. */
  entries: TimeEntry[];
}

/** Longest duration that can be logged by hand at once (matches the API). */
export const MAX_LOGGED_MINUTES = 24 * 60;
export const MAX_ESTIMATE_MINUTES = 99_999;

/** 0 → "0m", 2700 → "45m", 7200 → "2h", 8100 → "2h 15m". Seconds are dropped. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** A running timer: 754 → "12:34", 3754 → "1:02:34". */
export function formatClock(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const rest = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return h ? `${h}:${rest}` : rest;
}

/**
 * Minutes typed by the user: "1h 30m", "1h30", "45m", "1:30", or a number of hours ("2", "1.5", "1,5").
 * `null` when it can't be read or is not positive.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  let minutes: number;
  let match: RegExpMatchArray | null;
  if ((match = t.match(/^(\d+):([0-5]\d)$/))) {
    minutes = +match[1] * 60 + +match[2];
  } else if ((match = t.match(/^(\d+(?:\.\d+)?)$/))) {
    minutes = +match[1] * 60;
  } else if ((match = t.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?$/)) && (match[1] || match[2])) {
    minutes = (match[1] ? +match[1] * 60 : 0) + (match[2] ? +match[2] : 0);
  } else {
    return null;
  }
  minutes = Math.round(minutes);
  return minutes > 0 ? minutes : null;
}

/** How the time logged compares with the estimate, e.g. "45m left" or "1h 15m over". */
export function estimateStatus(loggedSeconds: number, estimateMinutes: number): { percent: number; text: string; over: boolean } {
  const diff = estimateMinutes * 60 - loggedSeconds;
  const over = diff < 0;
  return {
    percent: Math.round((loggedSeconds / (estimateMinutes * 60)) * 100),
    text: over ? `${formatDuration(-diff)} over` : `${formatDuration(diff)} left`,
    over,
  };
}
