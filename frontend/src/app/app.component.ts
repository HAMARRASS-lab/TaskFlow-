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
    <mat-toolbar color="primary">
      <mat-icon>task_alt</mat-icon>
      <span class="brand">TaskFlow</span>
      <span class="spacer"></span>
      @if (user$ | async; as user) {
        <span class="user" data-cy="current-user">{{ user.fullName }}</span>
        <button mat-icon-button (click)="logout()" aria-label="Logout" data-cy="logout">
          <mat-icon>logout</mat-icon>
        </button>
      }
    </mat-toolbar>
    <router-outlet />
  `,
  styles: [`.brand { margin-left: 8px; font-weight: 500; } .user { margin-right: 8px; font-size: 14px; }`],
})
export class AppComponent {
  private readonly store = inject(Store);
  readonly user$ = this.store.select(authFeature.selectUser);

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
