import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../core/auth/store/auth.actions';
import { authFeature } from '../../core/auth/store/auth.reducer';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatProgressBarModule],
  template: `
    <mat-card class="auth-card">
      @if (loading$ | async) { <mat-progress-bar mode="indeterminate" /> }
      <mat-card-header><mat-card-title>Create your account</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field class="full-width">
            <mat-label>Full name</mat-label>
            <input matInput formControlName="fullName" autocomplete="name" data-cy="fullName" />
          </mat-form-field>
          <mat-form-field class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" data-cy="email" />
          </mat-form-field>
          <mat-form-field class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" data-cy="password" />
            <mat-hint>At least 8 characters</mat-hint>
          </mat-form-field>
          @if (error$ | async; as error) { <p class="error-text" data-cy="error">{{ error }}</p> }
          <button mat-flat-button color="primary" class="full-width" type="submit"
                  [disabled]="form.invalid || (loading$ | async)" data-cy="submit">Create account</button>
        </form>
        <p>Already registered? <a routerLink="/login">Sign in</a></p>
      </mat-card-content>
    </mat-card>
  `,
})
export class RegisterComponent {
  private readonly store = inject(Store);
  readonly loading$ = this.store.select(authFeature.selectLoading);
  readonly error$ = this.store.select(authFeature.selectError);

  readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.valid) {
      this.store.dispatch(AuthActions.register({ request: this.form.getRawValue() }));
    }
  }
}
