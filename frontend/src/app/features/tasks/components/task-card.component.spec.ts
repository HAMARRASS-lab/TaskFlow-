import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Task } from '../task.models';
import { TaskCardComponent } from './task-card.component';

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;
  const task: Task = {
    id: 7, title: 'Write docs', description: 'README and API docs', status: 'TODO', priority: 'HIGH',
    dueDate: '2026-12-31', labels: ['bug', 'frontend'],
    checklist: [{ id: 1, title: 'Outline', done: true }, { id: 2, title: 'Examples', done: false }],
    createdAt: '2026-10-01T10:00:00', updatedAt: '2026-10-01T10:00:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TaskCardComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentInstance.task = task;
    fixture.detectChanges();
  });

  it('renders title, priority and description', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Write docs');
    expect(text).toContain('HIGH');
    expect(text).toContain('README and API docs');
  });

  it('shows labels and checklist progress, and expands the checklist', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('[data-cy=label-chip]')).map((c) => c.textContent)).toEqual(['bug', 'frontend']);
    expect(el.querySelector('[data-cy=checklist-progress]')?.textContent).toContain('1/2 done');
    expect(el.querySelector('[data-cy=checklist]')).toBeNull();

    (el.querySelector('[data-cy=checklist-progress]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-cy=checklist-item]')).toHaveLength(2);
  });

  it('emits checklistToggle when an item is ticked', () => {
    const spy = jest.fn();
    fixture.componentInstance.checklistToggle.subscribe(spy);
    fixture.nativeElement.querySelector('[data-cy=checklist-progress]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('[data-cy=checklist-item] input')[1].click();
    expect(spy).toHaveBeenCalledWith({ itemId: 2, done: true });
  });

  it('does not let a click on the checklist bubble (the Team page opens details on card click)', () => {
    const spy = jest.fn();
    fixture.nativeElement.addEventListener('click', spy);
    fixture.nativeElement.querySelector('[data-cy=checklist-progress]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('hides the checklist bar when there is no checklist', () => {
    fixture.componentRef.setInput('task', { ...task, checklist: [], labels: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-cy=checklist-progress]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-cy=task-labels]')).toBeNull();
  });

  it('emits remove with the task id', () => {
    const spy = jest.fn();
    fixture.componentInstance.remove.subscribe(spy);
    fixture.nativeElement.querySelector('[data-cy=delete-task]').click();
    expect(spy).toHaveBeenCalledWith(7);
  });

  it('emits edit with the task', () => {
    const spy = jest.fn();
    fixture.componentInstance.edit.subscribe(spy);
    fixture.nativeElement.querySelector('[data-cy=edit-task]').click();
    expect(spy).toHaveBeenCalledWith(task);
  });

  it('hides edit/delete and shows a status label when readonly', () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy=edit-task]')).toBeNull();
    expect(el.querySelector('[data-cy=delete-task]')).toBeNull();
    expect(el.querySelector('[data-cy=status-select]')).toBeNull();
    expect(el.querySelector('[data-cy=task-status]')?.textContent).toContain('To do');
  });
});
