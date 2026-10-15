import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Task, TaskStatus } from '../task.models';
import { TaskKanbanComponent } from './task-kanban.component';

const task = (id: number, status: TaskStatus): Task => ({
  id, status, title: `Task ${id}`, description: null, priority: 'MEDIUM', dueDate: null, labels: [], checklist: [],
  createdAt: '', updatedAt: '', owner: { id: 1, fullName: 'Alice Martin', email: 'alice@test.com' }, assignee: null, watchers: [],
});

describe('TaskKanbanComponent', () => {
  let fixture: ComponentFixture<TaskKanbanComponent>;
  const columns = [
    { status: 'TODO' as const, tasks: [task(1, 'TODO'), task(2, 'TODO')] },
    { status: 'IN_PROGRESS' as const, tasks: [] },
    { status: 'DONE' as const, tasks: [task(3, 'DONE')] },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TaskKanbanComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(TaskKanbanComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('meId', 1);
    fixture.detectChanges();
  });

  it('renders one column per status with its cards and count', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[data-cy=column-TODO] [data-cy=task-card]')).toHaveLength(2);
    expect(el.querySelector('[data-cy=column-TODO] [data-cy=column-count]')?.textContent).toBe('2');
    expect(el.querySelector('[data-cy=column-IN_PROGRESS]')?.textContent).toContain('Drop tasks here');
  });

  it('says "no matching tasks" in empty columns while filtering', () => {
    fixture.componentRef.setInput('filtered', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-cy=column-IN_PROGRESS]')?.textContent).toContain('No matching tasks');
  });

  it('emits a move only when a card is dropped on another column', () => {
    const spy = jest.fn();
    fixture.componentInstance.move.subscribe(spy);
    const todo = { data: 'TODO' }, done = { data: 'DONE' };
    const drop = (from: object, to: object) =>
      fixture.componentInstance.drop({ previousContainer: from, container: to, item: { data: columns[0].tasks[0] } } as
        unknown as CdkDragDrop<TaskStatus, TaskStatus, Task>);

    drop(todo, todo);
    expect(spy).not.toHaveBeenCalled();
    drop(todo, done);
    expect(spy).toHaveBeenCalledWith({ task: columns[0].tasks[0], status: 'DONE' });
  });

  it("makes a watched task read-only: no drag, no edit, but 'stop watching'", () => {
    const watched = { ...task(4, 'IN_PROGRESS'), owner: { id: 9, fullName: 'Bob Durand', email: 'bob@test.com' }, watchers: [{ id: 1, fullName: 'Alice Martin', email: 'alice@test.com' }] };
    const assigned = { ...task(5, 'IN_PROGRESS'), owner: { id: 2, fullName: 'Bob Durand', email: 'bob@test.com' }, assignee: { id: 1, fullName: 'Alice Martin', email: 'alice@test.com' } };
    fixture.componentRef.setInput('columns', [columns[0], { status: 'IN_PROGRESS' as const, tasks: [watched, assigned] }, columns[2]]);
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.unwatch.subscribe(spy);

    const [watchedCard, assignedCard] = fixture.nativeElement.querySelectorAll('[data-cy=column-IN_PROGRESS] app-task-card');
    expect(watchedCard.classList).not.toContain('draggable');
    expect(watchedCard.querySelector('[data-cy=edit-task]')).toBeNull();
    watchedCard.querySelector('[data-cy=unwatch-task]').click();
    expect(spy).toHaveBeenCalledWith(4);

    // the assignee can drag and edit, only the owner deletes
    expect(assignedCard.classList).toContain('draggable');
    expect(assignedCard.querySelector('[data-cy=edit-task]')).not.toBeNull();
    expect(assignedCard.querySelector('[data-cy=delete-task]')).toBeNull();
  });

  it('forwards status changes from the card select', () => {
    const spy = jest.fn();
    fixture.componentInstance.move.subscribe(spy);
    fixture.debugElement.query((d) => d.name === 'app-task-card').componentInstance.statusChange.emit('IN_PROGRESS');
    expect(spy).toHaveBeenCalledWith({ task: columns[0].tasks[0], status: 'IN_PROGRESS' });
  });
});
