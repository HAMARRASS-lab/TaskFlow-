import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { Task, TaskFilter } from '../task.models';
import { TasksActions } from './tasks.actions';

export interface TasksState extends EntityState<Task> {
  loading: boolean;
  error: string | null;
  filter: TaskFilter;
}

export const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const initialTasksState: TasksState = tasksAdapter.getInitialState({
  loading: false,
  error: null,
  filter: 'ALL',
});

const { selectAll } = tasksAdapter.getSelectors();

export const tasksFeature = createFeature({
  name: 'tasks',
  reducer: createReducer(
    initialTasksState,
    on(TasksActions.load, (state) => ({ ...state, loading: true, error: null })),
    on(TasksActions.loadSuccess, (state, { tasks }) => tasksAdapter.setAll(tasks, { ...state, loading: false })),
    on(TasksActions.createSuccess, (state, { task }) => tasksAdapter.addOne(task, state)),
    on(TasksActions.updateSuccess, (state, { task }) => tasksAdapter.upsertOne(task, state)),
    on(TasksActions.deleteSuccess, (state, { id }) => tasksAdapter.removeOne(id, state)),
    on(TasksActions.requestFailure, (state, { error }) => ({ ...state, loading: false, error })),
    on(TasksActions.setFilter, (state, { filter }) => ({ ...state, filter })),
    on(AuthActions.logout, () => initialTasksState),
  ),
  extraSelectors: ({ selectTasksState, selectFilter }) => {
    const selectAllTasks = createSelector(selectTasksState, selectAll);
    return {
      selectAllTasks,
      selectFilteredTasks: createSelector(selectAllTasks, selectFilter, (tasks, filter) =>
        filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter),
      ),
      selectStats: createSelector(selectAllTasks, (tasks) => ({
        total: tasks.length,
        todo: tasks.filter((t) => t.status === 'TODO').length,
        inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        done: tasks.filter((t) => t.status === 'DONE').length,
      })),
    };
  },
});
