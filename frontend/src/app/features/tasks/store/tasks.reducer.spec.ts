import { AuthActions } from '../../../core/auth/store/auth.actions';
import { Task } from '../task.models';
import { TasksActions } from './tasks.actions';
import { initialTasksState, tasksFeature } from './tasks.reducer';

const task = (id: number, status: Task['status'], createdAt: string): Task => ({
  id, status, createdAt, title: `Task ${id}`, description: null, priority: 'MEDIUM', dueDate: null, updatedAt: createdAt,
});

const reducer = tasksFeature.reducer;

describe('tasks reducer', () => {
  const tasks = [task(1, 'TODO', '2026-01-01'), task(2, 'DONE', '2026-01-03'), task(3, 'IN_PROGRESS', '2026-01-02')];

  it('sets loading on load', () => {
    expect(reducer(initialTasksState, TasksActions.load()).loading).toBe(true);
  });

  it('stores tasks sorted by createdAt desc on load success', () => {
    const state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks }));
    expect(state.loading).toBe(false);
    expect(state.ids).toEqual([2, 3, 1]);
  });

  it('adds, updates and removes tasks', () => {
    let state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks }));
    state = reducer(state, TasksActions.createSuccess({ task: task(4, 'TODO', '2026-02-01') }));
    expect(state.ids[0]).toBe(4);

    state = reducer(state, TasksActions.updateSuccess({ task: { ...tasks[0], status: 'DONE' } }));
    expect(state.entities[1]?.status).toBe('DONE');

    state = reducer(state, TasksActions.deleteSuccess({ id: 2 }));
    expect(state.ids).not.toContain(2);
  });

  it('records errors', () => {
    const state = reducer({ ...initialTasksState, loading: true }, TasksActions.requestFailure({ error: 'boom' }));
    expect(state).toMatchObject({ loading: false, error: 'boom' });
  });

  it('resets on logout', () => {
    const state = reducer(reducer(initialTasksState, TasksActions.loadSuccess({ tasks })), AuthActions.logout());
    expect(state).toEqual(initialTasksState);
  });
});

describe('tasks selectors', () => {
  const tasks = [task(1, 'TODO', '2026-01-01'), task(2, 'DONE', '2026-01-03'), task(3, 'DONE', '2026-01-02')];
  const state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks }));
  const root = { tasks: state };

  it('computes stats', () => {
    expect(tasksFeature.selectStats(root)).toEqual({ total: 3, todo: 1, inProgress: 0, done: 2 });
  });

  it('filters by status', () => {
    const filtered = { tasks: reducer(state, TasksActions.setFilter({ filter: 'DONE' })) };
    expect(tasksFeature.selectFilteredTasks(filtered).map((t) => t.id)).toEqual([2, 3]);
    expect(tasksFeature.selectFilteredTasks(root)).toHaveLength(3);
  });
});
