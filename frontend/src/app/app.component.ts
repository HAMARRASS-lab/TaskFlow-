import { Component, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { AuthActions } from './core/auth/store/auth.actions';
import { authFeature } from './core/auth/store/auth.reducer';
import { meetingsFeature } from './features/meetings/store/meetings.reducer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
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
        </nav>
      }
      <span class="spacer"></span>
      @if (user$ | async; as user) {
        <span class="avatar" aria-hidden="true">{{ initials(user.fullName) }}</span>
        <span class="user" data-cy="current-user">{{ user.fullName }}</span>
        <button mat-icon-button (click)="logout()" aria-label="Logout" data-cy="logout">
          <mat-icon>logout</mat-icon>
        </button>
      }
    </mat-toolbar>
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
    @media (max-width: 520px) { .user, .brand, .nav span:not(.badge) { display: none; } .nav { margin-left: 12px; } }
  `],
})
export class AppComponent {
  private readonly store = inject(Store);
  readonly user$ = this.store.select(authFeature.selectUser);
  private readonly invitations = this.store.selectSignal(meetingsFeature.selectInvitations);
  readonly invitationCount = computed(() => this.invitations().length);

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
