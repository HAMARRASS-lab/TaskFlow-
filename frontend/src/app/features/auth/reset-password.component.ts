import { Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';

export function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return confirm && password !== confirm ? { mismatch: true } : null;
}

/** Opened from the emailed link: `/reset-password?token=…`. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatProgressBarModule],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <div class="auth-head">
          <div class="logo"><mat-icon>password</mat-icon></div>
          <h1>Choose a new password</h1>
        </div>
        @if (!token()) {
          <p class="error-text" data-cy="error">This link is incomplete. Please open the link from the email again.</p>
        } @else if (done()) {
          <p class="notice" data-cy="reset-done">Your password has been changed. You can now sign in with it.</p>
          <a mat-flat-button color="primary" class="full-width submit" routerLink="/login">Sign in</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" data-cy="password" />
              <mat-hint>At least 8 characters</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm password</mat-label>
              <input matInput type="password" formControlName="confirm" autocomplete="new-password" data-cy="confirm" />
            </mat-form-field>
            @if (form.hasError('mismatch')) { <p class="error-text">Passwords don't match.</p> }
            @if (error(); as error) { <p class="error-text" data-cy="error">{{ error }}</p> }
            <button mat-flat-button color="primary" class="full-width submit" type="submit"
                    [disabled]="form.invalid || loading()" data-cy="submit">Change password</button>
          </form>
        }
        <p class="auth-foot"><a routerLink="/forgot-password">Request a new link</a></p>
      </div>
    </div>
  `,
  styles: [`.notice { margin: 0 0 16px; text-align: center; font-size: 14px; line-height: 1.6; }`],
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  /** Bound from the `token` query parameter. */
  readonly token = input<string>();
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  submit(): void {
    const token = this.token();
    if (this.form.invalid || !token) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
