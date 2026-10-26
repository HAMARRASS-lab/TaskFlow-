import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TaskActivityComponent } from './task-activity.component';
import { TaskEvent } from './activity.models';

describe('TaskActivityComponent', () => {
  let fixture: ComponentFixture<TaskActivityComponent>;
  let http: HttpTestingController;
  const url = '/api/tasks/7/activity';
  const event = (id: number, patch: Partial<TaskEvent> = {}): TaskEvent => ({
    id,
    type: 'STATUS',
    oldValue: 'TODO',
    newValue: 'DONE',
    actor: { id: 1, fullName: 'Alice Martin' },
    createdAt: '2026-10-01T09:30:00',
    ...patch,
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const all = (sel: string) => el().querySelectorAll(sel);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskActivityComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TaskActivityComponent);
    fixture.componentRef.setInput('taskId', 7);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function load(list: TaskEvent[]): void {
    http.expectOne(url).flush(list);
    fixture.detectChanges();
  }

  it('shows the timeline with who did what', () => {
    expect(el().textContent).toContain('Loading activity');
    load([event(1, { type: 'CREATED', oldValue: null, newValue: null }), event(2, { actor: null })]);
    const items = all('[data-cy=activity-event]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Alice Martin created the task');
    expect(items[1].textContent).toContain('A former user moved it from To do to Done');
  });

  it('shows an empty state', () => {
    load([]);
    expect(el().querySelector('[data-cy=no-activity]')).not.toBeNull();
  });

  it('shows only the latest changes until asked for the earlier ones', () => {
    load([1, 2, 3, 4, 5, 6, 7].map((id) => event(id)));
    expect(all('[data-cy=activity-event]').length).toBe(5);
    const earlier = el().querySelector('[data-cy=activity-earlier]') as HTMLButtonElement;
    expect(earlier.textContent).toContain('Show 2 earlier changes');

    earlier.click();
    fixture.detectChanges();
    expect(all('[data-cy=activity-event]').length).toBe(7);
    expect(el().querySelector('[data-cy=activity-earlier]')).toBeNull();
  });

  it('reloads when the task changes', () => {
    load([event(1)]);
    fixture.componentRef.setInput('version', '2026-10-02T10:00:00');
    fixture.detectChanges();
    load([event(1), event(2)]);
    expect(all('[data-cy=activity-event]').length).toBe(2);
  });

  it('shows a load error', () => {
    http.expectOne(url).flush({ detail: 'Task 7 not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('[data-cy=activity-error]')?.textContent).toContain('Task 7 not found');
  });
});
