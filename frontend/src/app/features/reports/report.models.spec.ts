import { hourTicks, isoDate, presetRange, rangeDays, shortDate } from './report.models';

describe('report models', () => {
  // a Thursday
  const today = new Date(2026, 9, 29, 15, 30);

  it('computes the period of each preset, weeks starting on Monday', () => {
    const iso = (r: { from: Date; to: Date }) => [isoDate(r.from), isoDate(r.to)];
    expect(iso(presetRange('WEEK', today))).toEqual(['2026-10-26', '2026-10-29']);
    expect(iso(presetRange('LAST_4_WEEKS', today))).toEqual(['2026-10-05', '2026-10-29']);
    expect(iso(presetRange('MONTH', today))).toEqual(['2026-10-01', '2026-10-29']);
    expect(iso(presetRange('LAST_3_MONTHS', today))).toEqual(['2026-08-01', '2026-10-29']);
    // a Sunday belongs to the week that started six days before
    expect(iso(presetRange('WEEK', new Date(2026, 10, 1)))).toEqual(['2026-10-26', '2026-11-01']);
  });

  it('counts the days of a period, both ends included', () => {
    expect(rangeDays({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 1) })).toBe(1);
    expect(rangeDays(presetRange('LAST_4_WEEKS', today))).toBe(25);
  });

  it('formats dates', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(shortDate('2026-10-05')).toBe('Oct 5');
  });

  it('picks round hour gridlines', () => {
    expect(hourTicks(0)).toEqual([0, 1]);
    expect(hourTicks(3.5 * 3600)).toEqual([0, 1, 2, 3, 4]);
    expect(hourTicks(9 * 3600)).toEqual([0, 5, 10]);
    expect(hourTicks(37 * 3600)).toEqual([0, 10, 20, 30, 40]);
    expect(hourTicks(120 * 3600)).toEqual([0, 50, 100, 150]);
  });
});
