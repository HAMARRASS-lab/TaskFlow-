import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { errorMessage } from '../../core/api';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { TaskFormDialogComponent } from '../tasks/components/task-form-dialog.component';
import { TaskRequest } from '../tasks/task.models';
import { AdminService, AdminUser, UserRequest } from './admin.service';
import { UserFormDialogComponent } from './user-form-dialog.component';

/** Admin page: add, edit and delete users, and assign them tasks. */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Users</h1>
          <p>Manage accounts and assign tasks.</p>
        </div>
        <button mat-flat-button color="primary" (click)="add()" data-cy="add-user">
          <mat-icon>person_add</mat-icon> New user
        </button>
      </header>

      @if (loading()) { <mat-progress-bar mode="indeterminate" class="loading" /> }
      @if (error()) { <p class="error" data-cy="error">{{ error() }}</p> }

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th class="hide-sm">Joined</th><th class="actions"></th></tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr data-cy="user-row">
                <td>
                  <a [routerLink]="['/team', user.id]" class="name">{{ user.fullName }}</a>
                  @if (user.id === me()?.id) { <em>(you)</em> }
                </td>
                <td class="email">{{ user.email }}</td>
                <td><span class="role" [attr.data-role]="user.role">{{ user.role === 'ADMIN' ? 'Admin' : 'User' }}</span></td>
                <td class="hide-sm muted">{{ user.createdAt | date: 'MMM d, y' }}</td>
                <td class="actions">
                  <button mat-icon-button (click)="assignTask(user)" matTooltip="Assign a task"
                          [attr.aria-label]="'Assign a task to ' + user.fullName" data-cy="assign-task">
                    <mat-icon>add_task</mat-icon>
                  </button>
                  <button mat-icon-button (click)="edit(user)" matTooltip="Edit"
                          [attr.aria-label]="'Edit ' + user.fullName" data-cy="edit-user">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="remove(user)" [disabled]="user.id === me()?.id"
                          matTooltip="Delete" [attr.aria-label]="'Delete ' + user.fullName" data-cy="delete-user">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </tr>
            } @empty {
              @if (!loading()) { <tr><td colspan="5" class="muted">No users.</td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .head h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
    .head p, .muted { margin: 4px 0 0; color: var(--tf-muted); font-size: 14px; }
    .error { color: var(--tf-high); }
    .loading { margin-bottom: 12px; }

    .table-wrap {
      overflow-x: auto; background: var(--tf-surface); border: 1px solid var(--tf-border);
      border-radius: var(--tf-radius); box-shadow: var(--tf-shadow);
    }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted); }
    th, td { padding: 10px 16px; border-bottom: 1px solid var(--tf-border); }
    tbody tr:last-child td { border-bottom: none; }
    .name { color: var(--tf-text); font-weight: 600; text-decoration: none; }
    .name:hover { color: var(--tf-accent); }
    em { font-style: normal; color: var(--tf-muted); margin-left: 4px; }
    .email { color: var(--tf-muted); word-break: break-all; }
    .role { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; }
    .role[data-role='ADMIN'] { background: var(--tf-accent-soft); color: var(--tf-accent); }
    .actions { text-align: right; white-space: nowrap; }
    .actions button { color: var(--tf-muted); }

    @media (max-width: 760px) { .page { padding: 24px 16px; } .hide-sm { display: none; } }
  `],
})
export class AdminUsersComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly me = inject(Store).selectSignal(authFeature.selectUser);

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  add(): void {
    this.dialog.open<UserFormDialogComponent, null, UserRequest>(UserFormDialogComponent, { width: '440px', maxWidth: '95vw' })
      .afterClosed().subscribe((request) => {
        if (request) this.run(this.admin.createUser(request), `${request.fullName} added`);
      });
  }

  edit(user: AdminUser): void {
    this.dialog.open<UserFormDialogComponent, AdminUser, UserRequest>(UserFormDialogComponent, {
      data: user, width: '440px', maxWidth: '95vw',
    }).afterClosed().subscribe((request) => {
      if (request) this.run(this.admin.updateUser(user.id, request), `${request.fullName} updated`);
    });
  }

  remove(user: AdminUser): void {
    if (!confirm(`Delete ${user.fullName}? Their tasks and meetings will be deleted too.`)) return;
    this.run(this.admin.deleteUser(user.id), `${user.fullName} deleted`);
  }

  assignTask(user: AdminUser): void {
    this.dialog.open<TaskFormDialogComponent, null, TaskRequest>(TaskFormDialogComponent, { width: '520px', maxWidth: '95vw' })
      .afterClosed().subscribe((request) => {
        if (request) this.run(this.admin.assignNewTask(user.id, request), `Task assigned to ${user.fullName}`);
      });
  }

  private run(call: Observable<unknown>, success: string): void {
    call.subscribe({
      next: () => {
        this.snackBar.open(success, 'Close', { duration: 3000 });
        this.load();
      },
      error: (e) => this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 }),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
