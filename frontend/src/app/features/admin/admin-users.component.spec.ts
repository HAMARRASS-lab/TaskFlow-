import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { AdminUsersComponent } from './admin-users.component';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let http: HttpTestingController;
  const users = [
    { id: 1, email: 'admin@demo.com', fullName: 'Ada Admin', role: 'ADMIN', createdAt: '2026-10-01T09:00:00' },
    { id: 2, email: 'bob@demo.com', fullName: 'Bob Durand', role: 'USER', createdAt: '2026-10-02T09:00:00' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: authFeature.selectUser, value: { id: 1, email: 'admin@demo.com', fullName: 'Ada Admin', role: 'ADMIN' } }] }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminUsersComponent);
    fixture.detectChanges();
    http.expectOne('/api/admin/users').flush(users);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists users and prevents deleting yourself', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-cy=user-row]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('(you)');
    expect(rows[0].querySelector('[data-cy=delete-user]').disabled).toBe(true);
    expect(rows[1].querySelector('[data-cy=delete-user]').disabled).toBe(false);
  });

  it('deletes a user after confirmation and reloads', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.componentInstance.remove(users[1] as never);
    const req = http.expectOne('/api/admin/users/2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne('/api/admin/users').flush([users[0]]);
  });

  it('assigns a new task to the chosen user', () => {
    const task = { title: 'Onboard', description: null, status: 'TODO', priority: 'MEDIUM', dueDate: null };
    jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({ afterClosed: () => of(task) } as never);
    fixture.componentInstance.assignTask(users[1] as never);
    const req = http.expectOne('/api/admin/users/2/tasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(task);
    req.flush({ id: 9, ...task });
    http.expectOne('/api/admin/users').flush(users);
  });
});
