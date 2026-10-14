import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from './core/api';
import { User } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { CalendarFeedDialogComponent } from './features/meetings/components/calendar-feed-dialog.component';
import { Store } from '@ngrx/store';
import { AuthActions } from './core/auth/store/auth.actions';
import { authFeature } from './core/auth/store/auth.reducer';
import { meetingsFeature } from './features/meetings/store/meetings.reducer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule,
    MatMenuModule],
  template: `
    <mat-toolbar class="topbar">
      <span class="logo"><mat-icon>task_alt</mat-icon></span>
      <span class="brand">TaskFlow</span>
      @if (user$ | async) {
        <nav class="nav">
          <a routerLink="/tasks" routerLinkActive="active" data-cy="nav-tasks">
            <mat-icon>checklist</mat-icon><span>Tasks</span>
          </a>
          <a routerLink="/calendar" routerLinkActive="active" data-cy="nav-calendar">
            <mat-icon>calendar_month</mat-icon><span>Calendar</span>
            @if (invitationCount(); as count) {
              <span class="badge" [attr.aria-label]="count + ' pending invitations'" data-cy="invitations-badge">{{ count }}</span>
            }
          </a>
          <a routerLink="/team" routerLinkActive="active" data-cy="nav-team">
            <mat-icon>group</mat-icon><span>Team</span>
          </a>
          @if (isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" data-cy="nav-admin">
              <mat-icon>admin_panel_settings</mat-icon><span>Admin</span>
            </a>
          }
        </nav>
      }
      <span class="spacer"></span>
      @if (user$ | async; as user) {
        <span class="avatar" aria-hidden="true">{{ initials(user.fullName) }}</span>
        <span class="user" data-cy="current-user">{{ user.fullName }}</span>
        <button mat-icon-button [matMenuTriggerFor]="account" aria-label="Account settings" data-cy="account-menu">
          <mat-icon>settings</mat-icon>
        </button>
        <mat-menu #account="matMenu" xPosition="before">
          <button mat-menu-item (click)="toggleDigest(user)" [disabled]="!user.emailVerified" data-cy="digest-toggle">
            <mat-icon>{{ user.digestEnabled ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
            <span>Daily email digest</span>
          </button>
          @if (!user.emailVerified) {
            <p class="menu-hint">Confirm your email to receive the digest.</p>
          }
          <a mat-menu-item routerLink="/calendar" (click)="openFeed()" data-cy="menu-calendar-sync">
            <mat-icon>sync</mat-icon><span>Sync with Google Calendar</span>
          </a>
        </mat-menu>
        <button mat-icon-button (click)="logout()" aria-label="Logout" data-cy="logout">
          <mat-icon>logout</mat-icon>
        </button>
      }
    </mat-toolbar>
    @if (user$ | async; as user) {
      @if (user.emailVerified === false) {
        <div class="verify-banner" role="status" data-cy="verify-banner">
          <mat-icon>mark_email_unread</mat-icon>
          <span>Please confirm your email: we sent a link to <strong>{{ user.email }}</strong>.</span>
          <button mat-button (click)="resendVerification()" [disabled]="resending()" data-cy="verify-resend">
            Resend email
          </button>
        </div>
      }
    }
    <router-outlet />
  `,
  styles: [`
    .topbar {
      position: sticky; top: 0; z-index: 10; height: 64px; padding: 0 20px;
      background: rgba(255, 255, 255, .85); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--tf-border); color: var(--tf-text);
    }
    .logo {
      width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #fff;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
    }
    .logo mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .brand { margin-left: 10px; font-weight: 700; font-size: 18px; letter-spacing: -.02em; }
    .nav { display: flex; gap: 4px; margin-left: 24px; }
    .nav a {
      display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 10px;
      color: var(--tf-muted); font-size: 14px; font-weight: 500; text-decoration: none;
    }
    .nav a:hover { background: #f1f2f6; color: var(--tf-text); }
    .nav a.active { background: var(--tf-accent-soft); color: var(--tf-accent); }
    .nav mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .nav .badge {
      min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 99px;
      display: inline-block; text-align: center; line-height: 18px; font-size: 11px; font-weight: 700;
      background: var(--tf-high); color: #fff;
    }
    .avatar {
      width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
      background: var(--tf-accent-soft); color: var(--tf-accent); font-size: 13px; font-weight: 600;
    }
    .user { margin: 0 6px 0 10px; font-size: 14px; font-weight: 500; }
    .topbar button { color: var(--tf-muted); }
    .menu-hint { margin: 0; padding: 0 16px 8px 56px; font-size: 12px; color: var(--tf-muted); max-width: 200px; }
    .verify-banner {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 20px;
      background: #fff7e6; border-bottom: 1px solid #fde4b0; color: #7a4b00; font-size: 14px;
    }
    .verify-banner mat-icon { color: var(--tf-progress); }
    .verify-banner button { margin-left: auto; }
    @media (max-width: 520px) { .user, .brand, .nav span:not(.badge) { display: none; } .nav { margin-left: 12px; } }
  `],
})
export class AppComponent {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly resending = signal(false);
  readonly user$ = this.store.select(authFeature.selectUser);
  private readonly invitations = this.store.selectSignal(meetingsFeature.selectInvitations);
  readonly invitationCount = computed(() => this.invitations().length);
  private readonly user = this.store.selectSignal(authFeature.selectUser);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  toggleDigest(user: User): void {
    this.auth.updatePreferences({ digestEnabled: !user.digestEnabled }).subscribe({
      next: (updated) => {
        this.store.dispatch(AuthActions.userUpdated({ user: updated }));
        this.snackBar.open(updated.digestEnabled ? 'Daily digest on' : 'Daily digest off', 'Close', { duration: 3000 });
      },
      error: (e) => this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 }),
    });
  }

  resendVerification(): void {
    this.resending.set(true);
    this.auth.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.snackBar.open('Confirmation email sent', 'Close', { duration: 3000 });
      },
      error: (e) => {
        this.resending.set(false);
        this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 });
      },
    });
  }

  openFeed(): void {
    this.dialog.open(CalendarFeedDialogComponent, { width: '560px', maxWidth: '95vw' });
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
