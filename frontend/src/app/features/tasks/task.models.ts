export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskFilter = TaskStatus | 'ALL';
/** Kanban columns, or the filterable card grid. */
export type TaskView = 'BOARD' | 'LIST';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export interface ChecklistItem {
  id: number;
  title: string;
  done: boolean;
}

/** A user as shown on a task (owner, assignee, watcher) or in the user directory. */
export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  /** Lower-case, sorted. */
  labels: string[];
  checklist: ChecklistItem[];
  /** Who created the task; only they can delete it. */
  owner: UserSummary;
  /** The teammate responsible for it; they can change it like the owner. */
  assignee: UserSummary | null;
  /** Users following it (sorted by name): it shows up, read-only, on their board. */
  watchers: UserSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskRequest {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  /** Replaces the labels; omit to keep them. */
  labels?: string[];
  /** Replaces the checklist in this order (items with an `id` are kept); omit to keep it. */
  checklist?: { id?: number | null; title: string; done: boolean }[];
  /** `null` or omitted = unassigned. */
  assigneeId?: number | null;
  /** Replaces the watchers; omit to keep them. */
  watcherIds?: number[];
}

export const MAX_LABELS = 10;
export const MAX_LABEL_LENGTH = 30;
export const MAX_CHECKLIST_ITEMS = 50;
export const MAX_WATCHERS = 20;

/** The owner and the assignee can change a task (same rule as the API). */
export function canEditTask(task: Pick<Task, 'owner' | 'assignee'>, userId: number | null | undefined): boolean {
  return userId != null && (task.owner.id === userId || task.assignee?.id === userId);
}

/** Only the owner can delete a task. */
export function canDeleteTask(task: Pick<Task, 'owner'>, userId: number | null | undefined): boolean {
  return userId != null && task.owner.id === userId;
}

export function isWatching(task: Pick<Task, 'watchers'>, userId: number | null | undefined): boolean {
  return userId != null && task.watchers.some((w) => w.id === userId);
}

/** Whether the task belongs on the user's board (same rule as `GET /api/tasks`). */
export function isOnBoardOf(task: Pick<Task, 'owner' | 'assignee' | 'watchers'>, userId: number | null | undefined): boolean {
  return canEditTask(task, userId) || isWatching(task, userId);
}

/** "Alice van Dijk" → "AV". */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/** Same rule as the API: trimmed, inner spaces collapsed, lower-case. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Background / text colour pairs for label chips. */
const LABEL_COLORS: [string, string][] = [
  ['#e0e7ff', '#4338ca'],
  ['#fce7f3', '#be185d'],
  ['#dcfce7', '#15803d'],
  ['#fef3c7', '#b45309'],
  ['#e0f2fe', '#0369a1'],
  ['#fee2e2', '#b91c1c'],
  ['#f3e8ff', '#7e22ce'],
  ['#ccfbf1', '#0f766e'],
];

/** A stable colour per label name, so "bug" looks the same on every card. */
export function labelColor(label: string): { background: string; color: string } {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const [background, color] = LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
  return { background, color };
}

/** Every label used by these tasks, sorted. */
export function collectLabels(tasks: Pick<Task, 'labels'>[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.labels))].sort();
}

export function checklistProgress(task: Pick<Task, 'checklist'>): { done: number; total: number; percent: number } {
  const total = task.checklist.length;
  const done = task.checklist.filter((i) => i.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** True when the task has a due date before today and is not done. */
export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate + 'T00:00:00') < today;
}
