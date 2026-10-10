import { Task } from './task.models';
import { DEFAULT_TASK_QUERY, TaskQuery, applyTaskQuery, isQueryActive } from './task-query';

const task = (id: number, overrides: Partial<Task> = {}): Task => ({
  id, title: `Task ${id}`, description: null, status: 'TODO', priority: 'MEDIUM', dueDate: null,
  createdAt: `2026-01-0${id}`, updatedAt: '', ...overrides,
});

const now = new Date(2026, 9, 10); // 2026-10-10, local time
const run = (tasks: Task[], query: Partial<TaskQuery>) =>
  applyTaskQuery(tasks, { ...DEFAULT_TASK_QUERY, ...query }, now).map((t) => t.id);

describe('applyTaskQuery', () => {
  it('returns every task newest first by default', () => {
    expect(run([task(1), task(3), task(2)], {})).toEqual([3, 2, 1]);
  });

  it('searches title and description, case- and accent-insensitive, all words required', () => {
    const tasks = [
      task(1, { title: 'Préparer la réunion' }),
      task(2, { title: 'Deploy', description: 'Push the new REUNION page' }),
      task(3, { title: 'Write tests' }),
    ];
    expect(run(tasks, { search: '  reunion ' })).toEqual([2, 1]);
    expect(run(tasks, { search: 'reunion page' })).toEqual([2]);
    expect(run(tasks, { search: 'nothing' })).toEqual([]);
  });

  it('filters by priority', () => {
    const tasks = [task(1, { priority: 'HIGH' }), task(2, { priority: 'LOW' }), task(3, { priority: 'HIGH' })];
    expect(run(tasks, { priority: 'HIGH' })).toEqual([3, 1]);
  });

  it('filters by due date', () => {
    const tasks = [
      task(1, { dueDate: '2026-10-09' }),                   // overdue
      task(2, { dueDate: '2026-10-09', status: 'DONE' }),   // past but done: not overdue
      task(3, { dueDate: '2026-10-10' }),                   // today
      task(4, { dueDate: '2026-10-17' }),                   // last day of the week window
      task(5, { dueDate: '2026-10-18' }),                   // beyond it
      task(6),                                              // no due date
    ];
    expect(run(tasks, { due: 'OVERDUE' })).toEqual([1]);
    expect(run(tasks, { due: 'TODAY' })).toEqual([3]);
    expect(run(tasks, { due: 'WEEK' })).toEqual([4, 3]);
    expect(run(tasks, { due: 'NONE' })).toEqual([6]);
  });

  it('sorts by due date (no date last), priority, title and age', () => {
    const tasks = [
      task(1, { title: 'banana', priority: 'LOW', dueDate: '2026-10-12' }),
      task(2, { title: 'Apple', priority: 'HIGH' }),
      task(3, { title: 'cherry', priority: 'HIGH', dueDate: '2026-10-11' }),
    ];
    expect(run(tasks, { sort: 'DUE_DATE' })).toEqual([3, 1, 2]);
    expect(run(tasks, { sort: 'PRIORITY' })).toEqual([3, 2, 1]);
    expect(run(tasks, { sort: 'TITLE' })).toEqual([2, 1, 3]);
    expect(run(tasks, { sort: 'OLDEST' })).toEqual([1, 2, 3]);
  });

  it('does not mutate its input', () => {
    const tasks = [task(1), task(2)];
    applyTaskQuery(tasks, DEFAULT_TASK_QUERY, now);
    expect(tasks.map((t) => t.id)).toEqual([1, 2]);
  });
});

describe('isQueryActive', () => {
  it('ignores the sort and blank searches', () => {
    expect(isQueryActive(DEFAULT_TASK_QUERY)).toBe(false);
    expect(isQueryActive({ ...DEFAULT_TASK_QUERY, sort: 'TITLE', search: '   ' })).toBe(false);
    expect(isQueryActive({ ...DEFAULT_TASK_QUERY, due: 'OVERDUE' })).toBe(true);
  });
});
