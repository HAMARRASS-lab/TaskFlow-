import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressBarModule],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <div class="auth-head">
          <div class="logo"><mat-icon>lock_reset</mat-icon></div>
          <h1>Forgot your password?</h1>
          <p>We'll email you a link to choose a new one</p>
        </div>
        @if (sent()) {
          <p class="notice" data-cy="reset-sent">
            If an account exists for <strong>{{ form.controls.email.value }}</strong>, a reset link is on its way.
            It is valid for 1 hour.
          </p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" data-cy="email" />
            </mat-form-field>
            @if (error(); as error) { <p class="error-text" data-cy="error">{{ error }}</p> }
            <button mat-flat-button color="primary" class="full-width submit" type="submit"
                    [disabled]="form.invalid || loading()" data-cy="submit">Send reset link</button>
          </form>
        }
        <p class="auth-foot"><a routerLink="/login">Back to sign in</a></p>
      </div>
    </div>
  `,
  styles: [`.notice { margin: 0; text-align: center; font-size: 14px; line-height: 1.6; }`],
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
