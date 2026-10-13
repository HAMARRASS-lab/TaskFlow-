import { AuthActions } from '../../../core/auth/store/auth.actions';
import { Task } from '../task.models';
import { TasksActions } from './tasks.actions';
import { initialTasksState, tasksFeature } from './tasks.reducer';

const task = (id: number, status: Task['status'], createdAt: string): Task => ({
  id, status, createdAt, title: `Task ${id}`, description: null, priority: 'MEDIUM', dueDate: null, labels: [], checklist: [], updatedAt: createdAt,
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

  it('changes status optimistically and restores it on failure', () => {
    let state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks }));
    state = reducer(state, TasksActions.changeStatus({ id: 1, status: 'DONE', from: 'TODO' }));
    expect(state.entities[1]?.status).toBe('DONE');

    state = reducer(state, TasksActions.changeStatusFailure({ id: 1, status: 'TODO', error: 'nope' }));
    expect(state.entities[1]?.status).toBe('TODO');
    expect(state.error).toBe('nope');
  });

  it('ticks checklist items optimistically and reverts on failure', () => {
    const withList = { ...tasks[0], checklist: [{ id: 5, title: 'a', done: false }, { id: 6, title: 'b', done: false }] };
    let state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks: [withList] }));
    state = reducer(state, TasksActions.toggleChecklistItem({ id: 1, itemId: 6, done: true }));
    expect(state.entities[1]?.checklist.map((i) => i.done)).toEqual([false, true]);

    state = reducer(state, TasksActions.toggleChecklistItemFailure({ id: 1, itemId: 6, done: false, error: 'x' }));
    expect(state.entities[1]?.checklist.map((i) => i.done)).toEqual([false, false]);
    expect(reducer(state, TasksActions.toggleChecklistItem({ id: 99, itemId: 1, done: true }))).toBe(state);
  });

  it('resets on logout but keeps the chosen view', () => {
    let state = reducer(initialTasksState, TasksActions.loadSuccess({ tasks }));
    state = reducer(state, TasksActions.setView({ view: 'LIST' }));
    expect(reducer(state, AuthActions.logout())).toEqual({ ...initialTasksState, view: 'LIST' });
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

  it('groups tasks into kanban columns, applying the query but not the status filter', () => {
    let s = reducer(state, TasksActions.setFilter({ filter: 'TODO' }));
    s = reducer(s, TasksActions.setQuery({ query: { sort: 'OLDEST' } }));
    const columns = tasksFeature.selectColumns({ tasks: s });
    expect(columns.map((c) => [c.status, c.tasks.map((t) => t.id)])).toEqual([
      ['TODO', [1]], ['IN_PROGRESS', []], ['DONE', [3, 2]],
    ]);
  });

  it('lists every label in use, sorted', () => {
    const labelled = reducer(initialTasksState, TasksActions.loadSuccess({
      tasks: [{ ...tasks[0], labels: ['ui', 'bug'] }, { ...tasks[1], labels: ['bug'] }],
    }));
    expect(tasksFeature.selectLabels({ tasks: labelled })).toEqual(['bug', 'ui']);
  });

  it('combines the status filter with the search query and sort', () => {
    let s = reducer(state, TasksActions.setFilter({ filter: 'DONE' }));
    s = reducer(s, TasksActions.setQuery({ query: { search: 'task 3' } }));
    expect(tasksFeature.selectFilteredTasks({ tasks: s }).map((t) => t.id)).toEqual([3]);
    expect(tasksFeature.selectQueryActive({ tasks: s })).toBe(true);

    s = reducer(s, TasksActions.setQuery({ query: { sort: 'OLDEST' } }));
    expect(s.query.search).toBe('task 3');
    s = reducer(s, TasksActions.resetQuery());
    expect(s.query).toEqual({ search: '', priority: 'ALL', label: null, due: 'ALL', sort: 'OLDEST' });
    expect(tasksFeature.selectFilteredTasks({ tasks: s }).map((t) => t.id)).toEqual([3, 2]);
  });
});
