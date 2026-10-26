import { describeEvent } from './activity.models';

describe('describeEvent', () => {
  it('describes each kind of change in words', () => {
    expect(describeEvent({ type: 'CREATED', oldValue: null, newValue: null })).toBe('created the task');
    expect(describeEvent({ type: 'STATUS', oldValue: 'TODO', newValue: 'IN_PROGRESS' })).toBe(
      'moved it from To do to In progress',
    );
    expect(describeEvent({ type: 'PRIORITY', oldValue: 'MEDIUM', newValue: 'HIGH' })).toBe(
      'changed the priority from Medium to High',
    );
  });

  it('tells assigning, unassigning and reassigning apart', () => {
    expect(describeEvent({ type: 'ASSIGNEE', oldValue: null, newValue: 'Bob' })).toBe('assigned it to Bob');
    expect(describeEvent({ type: 'ASSIGNEE', oldValue: 'Bob', newValue: null })).toBe('unassigned Bob');
    expect(describeEvent({ type: 'ASSIGNEE', oldValue: 'Bob', newValue: 'Carol' })).toBe(
      'reassigned it from Bob to Carol',
    );
  });

  it('formats due dates and handles setting or removing one', () => {
    expect(describeEvent({ type: 'DUE_DATE', oldValue: null, newValue: '2026-11-02' })).toBe(
      'set the due date to Nov 2, 2026',
    );
    expect(describeEvent({ type: 'DUE_DATE', oldValue: '2026-11-02', newValue: null })).toBe(
      'removed the due date (was Nov 2, 2026)',
    );
    expect(describeEvent({ type: 'DUE_DATE', oldValue: '2026-11-02', newValue: '2026-11-09' })).toBe(
      'moved the due date from Nov 2, 2026 to Nov 9, 2026',
    );
  });
});
