import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Task } from '../task.models';
import { TaskCardComponent } from './task-card.component';

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;
  const task: Task = {
    id: 7, title: 'Write docs', description: 'README and API docs', status: 'TODO', priority: 'HIGH',
    dueDate: '2026-12-31', createdAt: '2026-10-01T10:00:00', updatedAt: '2026-10-01T10:00:00',
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
});
