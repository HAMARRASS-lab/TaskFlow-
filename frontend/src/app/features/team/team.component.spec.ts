import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { TaskDetailDialogComponent } from './task-detail-dialog.component';
import { TeamComponent } from './team.component';

describe('TeamComponent', () => {
  let fixture: ComponentFixture<TeamComponent>;
  let http: HttpTestingController;
  const owners = [
    { id: 1, fullName: 'Alice Martin', email: 'alice@demo.com', todo: 1, inProgress: 0, done: 1, total: 2 },
    { id: 2, fullName: 'Bob Durand', email: 'bob@demo.com', todo: 0, inProgress: 1, done: 0, total: 1 },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TeamComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: authFeature.selectUser, value: { id: 2, email: 'bob@demo.com', fullName: 'Bob Durand', role: 'USER' } }] }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();
    http.expectOne('/api/users/task-owners').flush(owners);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists task owners and marks the current user', () => {
    const items = fixture.nativeElement.querySelectorAll('[data-cy=owner]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Alice Martin');
    expect(items[1].textContent).toContain('(you)');
  });

  it('loads the selected user tasks read-only and filters by status', () => {
    fixture.componentRef.setInput('userId', '1');
    fixture.detectChanges();
    http.expectOne('/api/users/1/tasks').flush([
      { id: 10, title: 'Plan', description: null, status: 'TODO', priority: 'LOW', dueDate: null, createdAt: '', updatedAt: '' },
      { id: 11, title: 'Ship', description: null, status: 'DONE', priority: 'HIGH', dueDate: null, createdAt: '', updatedAt: '' },
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy=selected-owner]')?.textContent).toContain('Alice Martin');
    expect(el.querySelectorAll('[data-cy=task-card]').length).toBe(2);
    expect(el.querySelector('[data-cy=edit-task]')).toBeNull();

    fixture.componentInstance.filter.set('DONE');
    fixture.detectChanges();
    const cards = el.querySelectorAll('[data-cy=task-card]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Ship');
  });

  it('searches and filters the selected user tasks, and resets when switching user', () => {
    fixture.componentRef.setInput('userId', '1');
    fixture.detectChanges();
    http.expectOne('/api/users/1/tasks').flush([
      { id: 10, title: 'Plan sprint', description: null, status: 'TODO', priority: 'LOW', dueDate: null, createdAt: '', updatedAt: '' },
      { id: 11, title: 'Ship release', description: null, status: 'DONE', priority: 'HIGH', dueDate: null, createdAt: '', updatedAt: '' },
    ]);
    const el: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;

    component.patchQuery({ search: 'ship' });
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-cy=task-card]').length).toBe(1);

    component.patchQuery({ priority: 'LOW' });
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-cy=task-card]').length).toBe(0);
    expect(el.querySelector('[data-cy=no-match]')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('[data-cy=clear-filters]')!.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-cy=task-card]').length).toBe(2);

    component.patchQuery({ search: 'plan' });
    fixture.componentRef.setInput('userId', '2');
    fixture.detectChanges();
    http.expectOne('/api/users/2/tasks').flush([]);
    expect(component.query().search).toBe('');
  });

  it('opens the task details when a card is clicked', () => {
    const open = jest.spyOn(TestBed.inject(MatDialog), 'open');
    const task = { id: 10, title: 'Plan', description: 'Full text', status: 'TODO', priority: 'LOW', dueDate: null, createdAt: '', updatedAt: '' };
    fixture.componentRef.setInput('userId', '1');
    fixture.detectChanges();
    http.expectOne('/api/users/1/tasks').flush([task]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-task-card').click();
    expect(open).toHaveBeenCalledWith(TaskDetailDialogComponent, expect.objectContaining({
      data: { task, ownerName: 'Alice Martin' },
    }));
  });
});
