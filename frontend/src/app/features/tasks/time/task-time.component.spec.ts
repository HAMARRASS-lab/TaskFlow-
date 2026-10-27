import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TaskTimeComponent } from './task-time.component';
import { TimeEntry, TimeSummary } from './time.models';

describe('TaskTimeComponent', () => {
  let fixture: ComponentFixture<TaskTimeComponent>;
  let http: HttpTestingController;
  const url = '/api/tasks/7/time';
  const entry = (id: number, patch: Partial<TimeEntry> = {}): TimeEntry => ({
    id,
    user: { id: 1, fullName: 'Alice Martin' },
    startedAt: '2026-10-27T09:00:00',
    endedAt: '2026-10-27T10:00:00',
    seconds: 3600,
    running: false,
    mine: true,
    note: null,
    ...patch,
  });
  const summary = (patch: Partial<TimeSummary> = {}): TimeSummary => ({
    estimateMinutes: null,
    loggedSeconds: 0,
    canLog: true,
    entries: [],
    ...patch,
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const $ = <T extends HTMLElement>(cy: string) => el().querySelector(`[data-cy=${cy}]`) as T;
  const text = (cy: string) => $(cy)?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskTimeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TaskTimeComponent);
    fixture.componentRef.setInput('taskId', 7);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  function load(s: TimeSummary): void {
    http.expectOne(url).flush(s);
    fixture.detectChanges();
  }

  it('compares the time logged with the estimate', () => {
    expect(el().textContent).toContain('Loading time');
    load(summary({ estimateMinutes: 120, loggedSeconds: 90 * 60, entries: [entry(1, { seconds: 90 * 60, note: 'Draft' })] }));

    expect(text('time-logged')).toBe('1h 30m');
    expect(($('time-estimate') as HTMLInputElement).value).toBe('2h');
    expect(text('time-progress')).toBe('75% of the estimate · 30m left');
    const row = $('time-entry');
    expect(row.querySelector('.who')?.textContent).toBe('Alice Martin');
    expect(row.querySelector('.dur')?.textContent).toBe('1h 30m');
    expect(row.querySelector('.note')?.textContent).toBe('Draft');
  });

  it('flags time over the estimate', () => {
    load(summary({ estimateMinutes: 60, loggedSeconds: 75 * 60 }));
    expect(text('time-progress')).toBe('125% of the estimate · 15m over');
    expect(el().querySelector('.bar.over')).not.toBeNull();
  });

  it('is read-only for someone who cannot track time on the task', () => {
    load(summary({ canLog: false, estimateMinutes: 60, entries: [entry(1, { mine: false, user: null })] }));
    expect($('time-start')).toBeNull();
    expect($('time-log')).toBeNull();
    expect($('time-delete')).toBeNull();
    expect(text('time-estimate')).toBe('1h');
    expect(text('time-entry')).toContain('A former user');
  });

  it('starts and stops the timer, which ticks while running', () => {
    jest.useFakeTimers();
    load(summary());
    expect($('no-time')).not.toBeNull();

    $<HTMLButtonElement>('time-start').click();
    const req = http.expectOne(`${url}/start`);
    expect(req.request.method).toBe('POST');
    req.flush(summary({ entries: [entry(2, { running: true, endedAt: null, seconds: 65 })] }));
    fixture.detectChanges();
    expect(text('time-stop')).toBe('stop Stop · 01:05');

    jest.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(text('time-stop')).toBe('stop Stop · 01:08');
    expect(text('time-running')).toBe('01:08');

    $<HTMLButtonElement>('time-stop').click();
    http.expectOne(`${url}/stop`).flush(summary({ loggedSeconds: 68, entries: [entry(2, { seconds: 68 })] }));
    fixture.detectChanges();
    expect($('time-stop')).toBeNull();
    expect($('time-start')).not.toBeNull();
    expect(text('time-logged')).toBe('1m');
  });

  it('logs time by hand', () => {
    load(summary());
    const duration = $<HTMLInputElement>('time-duration');
    const note = $<HTMLInputElement>('time-note');

    duration.value = 'soon';
    $<HTMLButtonElement>('time-log').click();
    fixture.detectChanges();
    expect(text('time-error')).toContain('like 45m, 1h 30m');

    duration.value = '1h 15m';
    note.value = '  Review ';
    $<HTMLButtonElement>('time-log').click();
    const req = http.expectOne(`${url}/entries`);
    expect(req.request.body).toEqual({ minutes: 75, note: 'Review' });
    req.flush(summary({ loggedSeconds: 75 * 60, entries: [entry(3, { seconds: 75 * 60 })] }));
    fixture.detectChanges();
    expect(duration.value).toBe('');
    expect(note.value).toBe('');
    expect($('time-error')).toBeNull();
    expect(text('time-logged')).toBe('1h 15m');
  });

  it('sets, keeps and removes the estimate', () => {
    load(summary({ estimateMinutes: 60 }));
    const input = $<HTMLInputElement>('time-estimate');

    input.value = '60m';
    input.dispatchEvent(new Event('blur'));
    http.expectNone(`${url}/estimate`);

    input.value = '2h 30m';
    input.dispatchEvent(new Event('blur'));
    const set = http.expectOne(`${url}/estimate`);
    expect(set.request.method).toBe('PUT');
    expect(set.request.body).toEqual({ minutes: 150 });
    set.flush(summary({ estimateMinutes: 150 }));
    fixture.detectChanges();

    input.value = '';
    input.dispatchEvent(new Event('blur'));
    expect(http.expectOne(`${url}/estimate`).request.body).toEqual({ minutes: null });
  });

  it('deletes an entry and shows server errors', () => {
    load(summary({ entries: [entry(4)] }));
    $<HTMLButtonElement>('time-delete').click();
    const req = http.expectOne(`${url}/entries/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ detail: 'Only the person who logged this time can delete it' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text('time-error')).toBe('Only the person who logged this time can delete it');
  });
});
