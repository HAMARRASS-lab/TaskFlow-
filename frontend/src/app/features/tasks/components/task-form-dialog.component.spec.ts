import { toIsoDate } from './task-form-dialog.component';

describe('toIsoDate', () => {
  it('formats local dates without timezone shift', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('returns null for empty values', () => {
    expect(toIsoDate(null)).toBeNull();
  });
});
