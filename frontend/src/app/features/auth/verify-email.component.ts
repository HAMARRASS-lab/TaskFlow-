import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { AuthActions } from '../../core/auth/store/auth.actions';
import { authFeature } from '../../core/auth/store/auth.reducer';

/** Opened from the emailed link: `/verify-email?token=…`. */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        @if (status() === 'pending') { <mat-progress-bar mode="indeterminate" /> }
        <div class="auth-head">
          <div class="logo"><mat-icon>{{ status() === 'error' ? 'error_outline' : 'mark_email_read' }}</mat-icon></div>
          <h1>
            @switch (status()) {
              @case ('pending') { Confirming your email… }
              @case ('done') { Email confirmed }
              @default { We couldn't confirm your email }
            }
          </h1>
        </div>
        @if (status() === 'done') {
          <p class="notice" data-cy="verify-done">Thanks! You can now receive the daily digest of your tasks and meetings.</p>
        }
        @if (error(); as error) {
          <p class="error-text" data-cy="error">{{ error }}</p>
          <p class="notice">Sign in and use “Resend email” in the banner to get a new link.</p>
        }
        @if (status() !== 'pending') {
          <a mat-flat-button color="primary" class="full-width submit" [routerLink]="signedIn() ? '/tasks' : '/login'">
            {{ signedIn() ? 'Go to my tasks' : 'Sign in' }}
          </a>
        }
      </div>
    </div>
  `,
  styles: [`.notice { margin: 0 0 16px; text-align: center; font-size: 14px; line-height: 1.6; }`],
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  /** Bound from the `token` query parameter. */
  readonly token = input<string>();
  readonly status = signal<'pending' | 'done' | 'error'>('pending');
  readonly error = signal<string | null>(null);
  private readonly currentUser = this.store.selectSignal(authFeature.selectUser);
  readonly signedIn = () => this.currentUser() !== null;

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.fail('This link is incomplete. Please open the link from the email again.');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: (user) => {
        this.status.set('done');
        // update the session only when the link belongs to the signed-in account
        if (this.currentUser()?.id === user.id) this.store.dispatch(AuthActions.userUpdated({ user }));
      },
      error: (e) => this.fail(errorMessage(e)),
    });
  }

  private fail(message: string): void {
    this.status.set('error');
    this.error.set(message);
  }
}
