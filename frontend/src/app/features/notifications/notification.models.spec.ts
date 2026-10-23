import { describeNotification, timeAgo } from './notification.models';

describe('notification models', () => {
  it('describes who did what', () => {
    expect(describeNotification({ type: 'TASK_ASSIGNED', actor: { id: 1, fullName: 'Alice' } })).toBe('Alice assigned you');
    expect(describeNotification({ type: 'TASK_COMMENTED', actor: null })).toBe('Someone commented on');
    expect(describeNotification({ type: 'MEETING_INVITED', actor: { id: 1, fullName: 'Bob' } })).toBe('Bob invited you to');
  });

  it('describes due-date reminders without an actor', () => {
    expect(describeNotification({ type: 'TASK_DUE_SOON', actor: null })).toBe('Due tomorrow:');
    expect(describeNotification({ type: 'TASK_OVERDUE', actor: null })).toBe('Overdue:');
  });

  it('formats relative times', () => {
    const now = new Date('2026-10-17T12:00:00');
    expect(timeAgo('2026-10-17T11:59:40', now)).toBe('just now');
    expect(timeAgo('2026-10-17T11:55:00', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-17T09:00:00', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-15T12:00:00', now)).toBe('2 d ago');
    expect(timeAgo('2026-09-01T12:00:00', now)).not.toContain('ago');
  });
});
