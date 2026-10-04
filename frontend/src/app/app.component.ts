import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { AuthActions } from './core/auth/store/auth.actions';
import { authFeature } from './core/auth/store/auth.reducer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar class="topbar">
      <span class="logo"><mat-icon>task_alt</mat-icon></span>
      <span class="brand">TaskFlow</span>
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
    .avatar {
      width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
      background: var(--tf-accent-soft); color: var(--tf-accent); font-size: 13px; font-weight: 600;
    }
    .user { margin: 0 6px 0 10px; font-size: 14px; font-weight: 500; }
    .topbar button { color: var(--tf-muted); }
    @media (max-width: 520px) { .user { display: none; } }
  `],
})
export class AppComponent {
  private readonly store = inject(Store);
  readonly user$ = this.store.select(authFeature.selectUser);

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
