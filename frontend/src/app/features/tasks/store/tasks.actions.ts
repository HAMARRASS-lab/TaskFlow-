import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Task, TaskFilter, TaskRequest, TaskStatus } from '../task.models';
import { TaskQuery } from '../task-query';

export const TasksActions = createActionGroup({
  source: 'Tasks',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ tasks: Task[] }>(),
    Create: props<{ request: TaskRequest }>(),
    'Create Success': props<{ task: Task }>(),
    Update: props<{ id: number; request: TaskRequest }>(),
    'Change Status': props<{ id: number; status: TaskStatus }>(),
    'Update Success': props<{ task: Task }>(),
    Delete: props<{ id: number }>(),
    'Delete Success': props<{ id: number }>(),
    'Request Failure': props<{ error: string }>(),
    'Set Filter': props<{ filter: TaskFilter }>(),
    'Set Query': props<{ query: Partial<TaskQuery> }>(),
    'Reset Query': emptyProps(),
  },
});
