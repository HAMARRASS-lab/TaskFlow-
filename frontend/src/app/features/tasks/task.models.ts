export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskFilter = TaskStatus | 'ALL';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRequest {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

/** True when the task has a due date before today and is not done. */
export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate + 'T00:00:00') < today;
}
