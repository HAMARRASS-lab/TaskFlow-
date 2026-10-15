import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Task, TaskFilter, TaskRequest, TaskStatus, TaskView } from '../task.models';
import { TaskQuery } from '../task-query';

export const TasksActions = createActionGroup({
  source: 'Tasks',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ tasks: Task[] }>(),
    Create: props<{ request: TaskRequest }>(),
    'Create Success': props<{ task: Task }>(),
    Update: props<{ id: number; request: TaskRequest }>(),
    /** Applied optimistically; `from` is restored if the API refuses it. */
    'Change Status': props<{ id: number; status: TaskStatus; from: TaskStatus }>(),
    'Change Status Failure': props<{ id: number; status: TaskStatus; error: string }>(),
    /** Applied optimistically, reverted on failure. */
    'Toggle Checklist Item': props<{ id: number; itemId: number; done: boolean }>(),
    'Toggle Checklist Item Failure': props<{ id: number; itemId: number; done: boolean; error: string }>(),
    'Update Success': props<{ task: Task }>(),
    Delete: props<{ id: number }>(),
    'Delete Success': props<{ id: number }>(),
    /** Stop following a task (it leaves the board). */
    Unwatch: props<{ id: number }>(),
    /** The task no longer concerns the user (unwatched, or they unassigned themselves): drop it from the board. */
    'Left Board': props<{ id: number }>(),
    'Request Failure': props<{ error: string }>(),
    'Set Filter': props<{ filter: TaskFilter }>(),
    'Set View': props<{ view: TaskView }>(),
    'Set Query': props<{ query: Partial<TaskQuery> }>(),
    'Reset Query': emptyProps(),
  },
});
