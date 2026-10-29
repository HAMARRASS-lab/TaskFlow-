import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TimeReportComponent } from './time-report.component';
import { TimeReport } from './report.models';

describe('TimeReportComponent', () => {
  let fixture: ComponentFixture<TimeReportComponent>;
  let http: HttpTestingController;
  const report = (patch: Partial<TimeReport> = {}): TimeReport => ({
    from: '2026-10-05',
    to: '2026-10-29',
    userId: null,
    totalSeconds: 10 * 3600,
    entryCount: 5,
    byUser: [{ id: 1, fullName: 'Alice Martin', seconds: 8 * 3600 }, { id: 2, fullName: 'Bob Stone', seconds: 2 * 3600 }],
    byLabel: [{ label: 'docs', seconds: 6 * 3600 }, { label: null, seconds: 4 * 3600 }],
    byWeek: [
      { weekStart: '2026-10-05', seconds: 2 * 3600 },
      { weekStart: '2026-10-12', seconds: 0 },
      { weekStart: '2026-10-19', seconds: 7 * 3600 },
      { weekStart: '2026-10-26', seconds: 3600 },
    ],
    topTasks: [
      { id: 7, title: 'Write the docs', estimateMinutes: 300, seconds: 6 * 3600 },
      { id: 8, title: 'Fix the build', estimateMinutes: null, seconds: 4 * 3600 },
    ],
    ...patch,
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const $ = <T extends HTMLElement>(cy: string) => el().querySelector(`[data-cy=${cy}]`) as T;
  const $$ = (cy: string) => Array.from(el().querySelectorAll(`[data-cy=${cy}]`)) as HTMLElement[];
  const text = (cy: string) => $(cy)?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 9, 29, 10, 0), doNotFake: ['queueMicrotask', 'nextTick'] });
    TestBed.configureTestingModule({
      imports: [TimeReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideNativeDateAdapter()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TimeReportComponent);
    fixture.detectChanges();
    http.expectOne('/api/users').flush([{ id: 2, fullName: 'Bob Stone', email: 'b@t.com' }]);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  function load(r: TimeReport, url = '/api/time/report?from=2026-10-05&to=2026-10-29'): void {
    http.expectOne(url).flush(r);
    fixture.detectChanges();
  }

  it('shows the last four weeks by default: totals, weeks, people, labels and tasks', () => {
    load(report());

    expect(text('total')).toBe('10h');
    expect(text('average')).toBe('2h 30m');
    expect(text('entries')).toBe('5');
    expect(text('people')).toBe('2');
    expect($$('week-col')).toHaveLength(4);
    expect($$('week-col')[2].getAttribute('aria-label')).toBe('Week of Oct 19: 7h');
    expect(text('by-user')).toContain('Alice Martin8h');
    expect(text('by-label')).toContain('No label');
    expect(text('top-tasks')).toContain('Write the docs6h5hwarning1h over');
    expect(text('top-tasks')).toContain('No estimate');
  });

  it('shows a tooltip for the week under the pointer, and a table on demand', () => {
    load(report());
    $$('week-col')[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(text('week-tip')).toBe('Week of Oct 52h');

    $('week-table-toggle').click();
    fixture.detectChanges();
    expect($('week-chart')).toBeNull();
    expect(text('week-table')).toContain('Oct 120m');
  });

  it('reloads for another period or person', () => {
    load(report());

    ($('preset-WEEK').querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    load(report(), '/api/time/report?from=2026-10-26&to=2026-10-29');

    fixture.componentInstance.chooseUser(2);
    load(report({ userId: 2 }), '/api/time/report?from=2026-10-26&to=2026-10-29&userId=2');
  });

  it('refuses a custom period longer than a year without asking the server', () => {
    load(report());
    fixture.componentInstance.custom.setValue({ start: new Date(2025, 0, 1), end: new Date(2026, 9, 1) });
    fixture.componentInstance.applyCustom();
    fixture.detectChanges();

    expect(text('error')).toContain('at most 366 days');
  });

  it('downloads the entries as CSV', () => {
    load(report());
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = jest.fn(() => 'blob:csv');
    URL.revokeObjectURL = jest.fn();

    $<HTMLButtonElement>('export-csv').click();
    http.expectOne('/api/time/report/csv?from=2026-10-05&to=2026-10-29').flush(new Blob(['Date\r\n']));

    expect(click).toHaveBeenCalled();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('time-2026-10-05-to-2026-10-29.csv');
  });
});
