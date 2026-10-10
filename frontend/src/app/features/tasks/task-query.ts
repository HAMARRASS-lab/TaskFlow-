import { Task, TaskPriority } from './task.models';

export type DueFilter = 'ALL' | 'OVERDUE' | 'TODAY' | 'WEEK' | 'NONE';
export type TaskSort = 'NEWEST' | 'OLDEST' | 'DUE_DATE' | 'PRIORITY' | 'TITLE';

/** Client-side search, filters and sort applied on top of the status filter. */
export interface TaskQuery {
  search: string;
  priority: TaskPriority | 'ALL';
  due: DueFilter;
  sort: TaskSort;
}

export const DEFAULT_TASK_QUERY: TaskQuery = { search: '', priority: 'ALL', due: 'ALL', sort: 'NEWEST' };

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  ALL: 'Any due date',
  OVERDUE: 'Overdue',
  TODAY: 'Due today',
  WEEK: 'Due in 7 days',
  NONE: 'No due date',
};

export const SORT_LABELS: Record<TaskSort, string> = {
  NEWEST: 'Newest first',
  OLDEST: 'Oldest first',
  DUE_DATE: 'Due date',
  PRIORITY: 'Priority',
  TITLE: 'Title (A–Z)',
};

const PRIORITY_RANK: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** True when the query filters anything out (sort alone does not count). */
export function isQueryActive(query: TaskQuery): boolean {
  return query.search.trim() !== '' || query.priority !== 'ALL' || query.due !== 'ALL';
}

/** Lower-cases and strips accents so "réunion" matches "reunion". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Local date as `YYYY-MM-DD`, the format of `Task.dueDate`. */
function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function matchesDue(task: Task, due: DueFilter, today: string, inAWeek: string): boolean {
  switch (due) {
    case 'ALL': return true;
    case 'NONE': return !task.dueDate;
    case 'OVERDUE': return !!task.dueDate && task.status !== 'DONE' && task.dueDate < today;
    case 'TODAY': return task.dueDate === today;
    case 'WEEK': return !!task.dueDate && task.dueDate >= today && task.dueDate <= inAWeek;
  }
}

function compareDue(a: Task, b: Task): number {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function comparator(sort: TaskSort): (a: Task, b: Task) => number {
  const newest = (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case 'NEWEST': return newest;
    case 'OLDEST': return (a, b) => a.createdAt.localeCompare(b.createdAt);
    case 'DUE_DATE': return (a, b) => compareDue(a, b) || newest(a, b);
    case 'PRIORITY': return (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || compareDue(a, b) || newest(a, b);
    case 'TITLE': return (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }
}

/** Filters tasks by text (title + description), priority and due date, then sorts them. */
export function applyTaskQuery(tasks: Task[], query: TaskQuery, now = new Date()): Task[] {
  const terms = normalize(query.search).split(/\s+/).filter(Boolean);
  const today = isoDate(now);
  const inAWeek = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

  return tasks
    .filter((t) => query.priority === 'ALL' || t.priority === query.priority)
    .filter((t) => matchesDue(t, query.due, today, inAWeek))
    .filter((t) => {
      if (!terms.length) return true;
      const haystack = normalize(`${t.title} ${t.description ?? ''}`);
      return terms.every((term) => haystack.includes(term));
    })
    .sort(comparator(query.sort));
}
