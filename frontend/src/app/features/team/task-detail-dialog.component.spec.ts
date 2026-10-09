import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TaskDetailDialogComponent, TaskDetailData } from './task-detail-dialog.component';

describe('TaskDetailDialogComponent', () => {
  const close = jest.fn();

  function render(data: TaskDetailData): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TaskDetailDialogComponent],
      providers: [provideNoopAnimations(), { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } }],
    });
    const fixture = TestBed.createComponent(TaskDetailDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const task = {
    id: 1, title: 'Design the onboarding flow', description: 'Line one\nLine two', status: 'IN_PROGRESS' as const,
    priority: 'HIGH' as const, dueDate: '2000-01-01', createdAt: '2026-10-01T09:30:00', updatedAt: '2026-10-02T10:00:00',
  };

  it('shows the full task with its owner and marks it overdue', () => {
    const el = render({ task, ownerName: 'Alice Martin' });
    expect(el.querySelector('[data-cy=detail-title]')?.textContent).toContain('Design the onboarding flow');
    expect(el.querySelector('[data-cy=detail-description]')?.textContent).toBe('Line one\nLine two');
    expect(el.querySelector('[data-cy=detail-status]')?.textContent).toContain('In progress');
    expect(el.querySelector('[data-cy=detail-owner]')?.textContent).toContain('Alice Martin');
    expect(el.textContent).toContain('Overdue');
  });

  it('handles a task without description or due date', () => {
    const el = render({ task: { ...task, description: null, dueDate: null, status: 'DONE' }, ownerName: 'Bob' });
    expect(el.textContent).toContain('No description.');
    expect(el.textContent).toContain('None');
    expect(el.textContent).not.toContain('Overdue');
  });

  it('hides reassignment for non-admins', () => {
    const el = render({ task, ownerName: 'Bob' });
    expect(el.querySelector('[data-cy=detail-reassign]')).toBeNull();
  });

  it('lets an admin reassign the task to another user', () => {
    const data = { task, ownerName: 'Alice', ownerId: 1, assignees: [{ id: 1, fullName: 'Alice' }, { id: 2, fullName: 'Bob' }] };
    TestBed.configureTestingModule({
      imports: [TaskDetailDialogComponent],
      providers: [provideNoopAnimations(), { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } }],
    });
    const fixture = TestBed.createComponent(TaskDetailDialogComponent);
    fixture.detectChanges();
    const button = () => fixture.nativeElement.querySelector('[data-cy=detail-reassign]') as HTMLButtonElement;
    expect(button().disabled).toBe(true);

    fixture.componentInstance.assigneeId = 2;
    fixture.detectChanges();
    button().click();
    expect(close).toHaveBeenCalledWith(2);
  });
});
