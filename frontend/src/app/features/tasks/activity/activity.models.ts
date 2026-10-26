import { formatDate } from '@angular/common';
import { STATUS_LABELS, TaskStatus } from '../task.models';

export type TaskEventType = 'CREATED' | 'STATUS' | 'PRIORITY' | 'ASSIGNEE' | 'DUE_DATE';

/** One change in a task's history. `null` values mean "none" (unassigned, no due date). */
export interface TaskEvent {
  id: number;
  type: TaskEventType;
  /** A status or priority name, an ISO date or the assignee's name. */
  oldValue: string | null;
  newValue: string | null;
  /** `null` when the user who made the change has since been deleted. */
  actor: { id: number; fullName: string } | null;
  createdAt: string;
}

export const EVENT_ICONS: Record<TaskEventType, string> = {
  CREATED: 'add_circle_outline',
  STATUS: 'swap_horiz',
  PRIORITY: 'flag',
  ASSIGNEE: 'person_outline',
  DUE_DATE: 'event',
};

/** What the actor did, to follow their name: "moved it from To do to In progress". */
export function describeEvent(e: Pick<TaskEvent, 'type' | 'oldValue' | 'newValue'>): string {
  const { oldValue: from, newValue: to } = e;
  switch (e.type) {
    case 'CREATED':
      return 'created the task';
    case 'STATUS':
      return `moved it from ${status(from)} to ${status(to)}`;
    case 'PRIORITY':
      return `changed the priority from ${priority(from)} to ${priority(to)}`;
    case 'ASSIGNEE':
      if (!from) return `assigned it to ${to}`;
      if (!to) return `unassigned ${from}`;
      return `reassigned it from ${from} to ${to}`;
    case 'DUE_DATE':
      if (!from) return `set the due date to ${day(to)}`;
      if (!to) return `removed the due date (was ${day(from)})`;
      return `moved the due date from ${day(from)} to ${day(to)}`;
  }
}

const status = (v: string | null) => (v ? STATUS_LABELS[v as TaskStatus] ?? v : 'none');
const priority = (v: string | null) => (v ? v.charAt(0) + v.slice(1).toLowerCase() : 'none');
const day = (v: string | null) => (v ? formatDate(v, 'MMM d, y', 'en-US') : 'none');
