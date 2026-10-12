import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Task } from '../task.models';
import { TaskFormData, TaskFormDialogComponent, toIsoDate } from './task-form-dialog.component';

describe('toIsoDate', () => {
  it('formats local dates without timezone shift', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('returns null for empty values', () => {
    expect(toIsoDate(null)).toBeNull();
  });
});

describe('TaskFormDialogComponent', () => {
  const close = jest.fn();
  const task: Task = {
    id: 3, title: 'Release', description: null, status: 'TODO', priority: 'HIGH', dueDate: null,
    labels: ['bug'], checklist: [{ id: 8, title: 'Tag', done: true }], createdAt: '', updatedAt: '',
  };

  function create(data: TaskFormData) {
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [TaskFormDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideNativeDateAdapter(),
        { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }],
    });
    const fixture = TestBed.createComponent(TaskFormDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('sends labels and the checklist, keeping existing item ids', () => {
    const dialog = create({ task, labels: ['bug', 'ui'] });
    dialog['pushLabel']('  Front End ');
    dialog['pushLabel']('BUG');                 // duplicate, ignored
    dialog.newItem.setValue(' Write notes ');
    dialog.addItem();
    dialog.save();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Release',
      labels: ['bug', 'front end'],
      checklist: [{ id: 8, title: 'Tag', done: true }, { id: null, title: 'Write notes', done: false }],
    }));
  });

  it('suggests labels in use that are not already on the task', () => {
    const dialog = create({ task, labels: ['bug', 'ui', 'urgent'] });
    expect(dialog.suggestions()).toEqual(['ui', 'urgent']);
    dialog.labelInput.setValue('urg');
    expect(dialog.suggestions()).toEqual(['urgent']);
  });

  it('keeps text left in the inputs when saving and removes items', () => {
    const dialog = create({ task: null, labels: [] });
    dialog.form.controls.title.setValue('New');
    dialog.labelInput.setValue('Urgent');
    dialog.newItem.setValue('First');
    dialog.save();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      labels: ['urgent'], checklist: [{ id: null, title: 'First', done: false }],
    }));
  });

  it('does not save a blank checklist item', () => {
    const dialog = create({ task, labels: [] });
    dialog.checklist.at(0).controls.title.setValue('   ');
    dialog.save();
    expect(close).not.toHaveBeenCalled();
    dialog.removeItem(0);
    dialog.save();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ checklist: [] }));
  });
});
