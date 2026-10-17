import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TaskDetailDialogComponent, TaskDetailData } from './task-detail-dialog.component';

describe('TaskDetailDialogComponent', () => {
  const close = jest.fn();
  const signedIn = provideMockStore({ selectors: [{ selector: authFeature.selectUser, value: { id: 2, email: 'bob@test.com', fullName: 'Bob Durand', role: 'USER' } }] });

  let fixture: ComponentFixture<TaskDetailDialogComponent>;

  function render(data: TaskDetailData): HTMLElement {
    close.mockClear();
    TestBed.configureTestingModule({
      imports: [TaskDetailDialogComponent],
      providers: [provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(), { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        signedIn],
    });
    fixture = TestBed.createComponent(TaskDetailDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const task = {
    id: 1, title: 'Design the onboarding flow', description: 'Line one\nLine two', status: 'IN_PROGRESS' as const,
    priority: 'HIGH' as const, dueDate: '2000-01-01', labels: ['design', 'ux'],
    checklist: [{ id: 1, title: 'Wireframes', done: true }, { id: 2, title: 'Copy', done: false }],
    createdAt: '2026-10-01T09:30:00', updatedAt: '2026-10-02T10:00:00',
    owner: { id: 1, fullName: 'Alice Martin', email: 'alice@test.com' }, assignee: null,
    watchers: [] as { id: number; fullName: string; email: string }[],
  };
  const bob = { id: 2, fullName: 'Bob Durand', email: 'bob@test.com' };
  const carol = { id: 3, fullName: 'Carol Petit', email: 'carol@test.com' };

  it('shows the assignee and watchers, and lets the viewer watch the task', () => {
    const el = render({ task: { ...task, assignee: carol, watchers: [carol] }, ownerName: 'Alice Martin' });
    expect(el.querySelector('[data-cy=detail-assigned-to]')?.textContent).toContain('Carol Petit');
    expect(el.querySelector('[data-cy=detail-watchers]')?.textContent).toContain('Carol Petit');

    const watch = el.querySelector<HTMLButtonElement>('[data-cy=detail-watch]')!;
    expect(watch.textContent).toContain('Watch');
    watch.click();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/tasks/1/watch');
    expect(req.request.method).toBe('PUT');
    req.flush({ ...task, assignee: carol, watchers: [bob, carol] });
    fixture.detectChanges();

    expect(el.querySelector('[data-cy=detail-watchers]')?.textContent).toContain('Bob Durand, Carol Petit');
    expect(watch.textContent).toContain('Stop watching');
  });

  it('stops watching with DELETE', () => {
    const el = render({ task: { ...task, watchers: [bob] }, ownerName: 'Alice Martin' });
    el.querySelector<HTMLButtonElement>('[data-cy=detail-watch]')!.click();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/tasks/1/watch');
    expect(req.request.method).toBe('DELETE');
    req.flush({ ...task, watchers: [] });
    fixture.detectChanges();
    expect(el.querySelector('[data-cy=detail-watchers]')?.textContent).toContain('None');
  });

  it('shows the full task with its owner and marks it overdue', () => {
    const el = render({ task, ownerName: 'Alice Martin' });
    expect(el.querySelector('[data-cy=detail-title]')?.textContent).toContain('Design the onboarding flow');
    expect(el.querySelector('[data-cy=detail-description]')?.textContent).toBe('Line one\nLine two');
    expect(el.querySelector('[data-cy=detail-status]')?.textContent).toContain('In progress');
    expect(el.querySelector('[data-cy=detail-owner]')?.textContent).toContain('Alice Martin');
    expect(el.textContent).toContain('Overdue');
  });

  it('shows labels and the checklist read-only', () => {
    const el = render({ task, ownerName: 'Alice Martin' });
    expect(Array.from(el.querySelectorAll('[data-cy=label-chip]')).map((c) => c.textContent)).toEqual(['design', 'ux']);
    expect(el.textContent).toContain('Checklist · 1/2');
    expect(el.querySelectorAll('[data-cy=detail-checklist] li.done')).toHaveLength(1);
  });

  it('handles a task without description or due date', () => {
    const el = render({ task: { ...task, description: null, dueDate: null, status: 'DONE' }, ownerName: 'Bob' });
    expect(el.textContent).toContain('No description.');
    expect(el.textContent).toContain('None');
    expect(el.textContent).not.toContain('Overdue');
  });

  it('hides the admin section for non-admins', () => {
    const el = render({ task, ownerName: 'Bob' });
    expect(el.querySelector('[data-cy=detail-admin]')).toBeNull();
    expect(el.querySelector('[data-cy=detail-transfer]')).toBeNull();
  });

  const users = [
    { id: 1, fullName: 'Alice Martin', email: 'alice@test.com' },
    { id: 2, fullName: 'Bob Durand', email: 'bob@test.com' },
  ];

  it('lets an admin transfer the task to another user', () => {
    render({ task, ownerName: 'Alice', ownerId: 1, users });
    const button = () => fixture.nativeElement.querySelector('[data-cy=detail-transfer]') as HTMLButtonElement;
    expect(button().disabled).toBe(true);

    fixture.componentInstance.transferTo = 2;
    fixture.detectChanges();
    button().click();
    expect(close).toHaveBeenCalledWith(2);
  });

  it('lets an admin assign the task to any user at once, and unassign it', () => {
    const el = render({ task, ownerName: 'Alice', ownerId: 1, users });
    const changes: unknown[] = [];
    fixture.componentInstance.taskChange.subscribe((t) => changes.push(t));
    const http = TestBed.inject(HttpTestingController);

    fixture.componentInstance.assign(2);
    let req = http.expectOne('/api/admin/tasks/1/assignee');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ userId: 2 });
    req.flush({ ...task, assignee: users[1] });
    fixture.detectChanges();
    expect(el.querySelector('[data-cy=detail-assigned-to]')?.textContent).toContain('Bob Durand');
    expect(changes).toHaveLength(1);

    fixture.componentInstance.assign(null);
    req = http.expectOne('/api/admin/tasks/1/assignee');
    expect(req.request.body).toEqual({ userId: null });
    req.flush({ ...task, assignee: null });
    fixture.detectChanges();
    expect(el.querySelector('[data-cy=detail-assigned-to]')?.textContent).toContain('Unassigned');
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps the assignee when the API refuses the change', () => {
    const el = render({ task: { ...task, assignee: users[0] }, ownerName: 'Alice', ownerId: 1, users });
    fixture.componentInstance.assign(2);
    TestBed.inject(HttpTestingController).expectOne('/api/admin/tasks/1/assignee')
      .flush({ detail: 'Unknown assignee' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('[data-cy=detail-assigned-to]')?.textContent).toContain('Alice Martin');
    expect(fixture.componentInstance.busy()).toBe(false);
  });
});
