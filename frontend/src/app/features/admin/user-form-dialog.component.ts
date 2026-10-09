import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { AdminUser, Role, UserRequest } from './admin.service';

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit user' : 'New user' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Full name</mat-label>
          <input matInput formControlName="fullName" maxlength="255" cdkFocusInitial data-cy="user-name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" data-cy="user-email" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ data ? 'New password (leave empty to keep)' : 'Password' }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" data-cy="user-password" />
          <mat-hint>At least 8 characters</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role" data-cy="user-role">
            <mat-option value="USER">User</mat-option>
            <mat-option value="ADMIN">Admin</mat-option>
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" data-cy="user-save">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`mat-form-field { width: 100%; margin-bottom: 8px; }`],
})
export class UserFormDialogComponent {
  readonly data = inject<AdminUser | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent, UserRequest>);

  readonly form = inject(FormBuilder).nonNullable.group({
    fullName: [this.data?.fullName ?? '', [Validators.required, Validators.maxLength(255)]],
    email: [this.data?.email ?? '', [Validators.required, Validators.email]],
    password: ['', this.data
      ? [Validators.minLength(8), Validators.maxLength(100)]
      : [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    role: [this.data?.role ?? ('USER' as Role), Validators.required],
  });

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({ ...v, fullName: v.fullName.trim(), email: v.email.trim() });
  }
}
