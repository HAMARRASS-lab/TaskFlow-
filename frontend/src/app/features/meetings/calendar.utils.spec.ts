import { addMonths, atTime, monthGrid, parseLocal, toDayKey, toLocalDateTime, toTime } from './calendar.utils';

describe('calendar utils', () => {
  it('formats local date-times without timezone shift', () => {
    expect(toLocalDateTime(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05T09:30:00');
    expect(toDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('round-trips API values', () => {
    const d = parseLocal('2026-10-06T14:05:00');
    expect(toTime(d)).toBe('14:05');
    expect(toDayKey(parseLocal('2026-10-06'))).toBe('2026-10-06');
  });

  it('combines a day with a time', () => {
    expect(toLocalDateTime(atTime(new Date(2026, 9, 6), '08:15'))).toBe('2026-10-06T08:15:00');
  });

  it('builds a 6-week grid starting on Monday', () => {
    const grid = monthGrid(new Date(2026, 9, 15)); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(toDayKey(grid[0])).toBe('2026-09-28');
    expect(grid[0].getDay()).toBe(1);
    expect(toDayKey(grid[3])).toBe('2026-10-01');
  });

  it('navigates months across years', () => {
    expect(toDayKey(addMonths(new Date(2026, 11, 20), 1))).toBe('2027-01-01');
    expect(toDayKey(addMonths(new Date(2026, 0, 31), -1))).toBe('2025-12-01');
  });
});
