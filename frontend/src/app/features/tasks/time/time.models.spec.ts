import { estimateStatus, formatClock, formatDuration, parseDuration } from './time.models';

describe('time models', () => {
  it('formats durations in hours and minutes', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(45 * 60)).toBe('45m');
    expect(formatDuration(2 * 3600)).toBe('2h');
    expect(formatDuration(2 * 3600 + 15 * 60 + 30)).toBe('2h 15m');
  });

  it('formats a running timer as a clock', () => {
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(754)).toBe('12:34');
    expect(formatClock(3754)).toBe('1:02:34');
  });

  it.each([
    ['1h 30m', 90], ['1h30', 90], ['1h', 60], ['45m', 45], ['45 m', 45], ['1:30', 90],
    ['2', 120], ['1.5', 90], ['1,5', 90], ['0.25h', 15], [' 2H 5M ', 125],
  ])('reads "%s" as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', 'abc', '0', '0m', 'm', 'h', '1:75', '-1', '1h 30x'])('rejects "%s"', (text) => {
    expect(parseDuration(text)).toBeNull();
  });

  it('compares the time logged with the estimate', () => {
    expect(estimateStatus(45 * 60, 60)).toEqual({ percent: 75, text: '15m left', over: false });
    expect(estimateStatus(0, 120)).toEqual({ percent: 0, text: '2h left', over: false });
    expect(estimateStatus(135 * 60, 60)).toEqual({ percent: 225, text: '1h 15m over', over: true });
  });
});
