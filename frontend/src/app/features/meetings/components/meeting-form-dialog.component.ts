import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { atTime, parseLocal, toLocalDateTime, toTime } from '../calendar.utils';
import { MeetingDialogData, MeetingRequest, PARTICIPANT_STATUS_ICONS, ParticipantStatus } from '../meeting.models';

/** What the dialog closes with: the meeting to save, or `'delete'` for an existing one. */
export type MeetingDialogResult = MeetingRequest | 'delete';

/** End time must be strictly after the start time (both `HH:mm`, same day). */
export function timeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const { start, end } = group.value as { start: string; end: string };
  return start && end && end <= start ? { timeRange: true } : null;
}

@Component({
  selector: 'app-meeting-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatButtonModule, MatChipsModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ meeting ? 'Edit meeting' : 'New meeting' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" cdkFocusInitial data-cy="meeting-title" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline" class="date">
            <mat-label>Date</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="date" data-cy="meeting-date" />
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-datepicker #picker />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Start</mat-label>
            <input matInput type="time" formControlName="start" data-cy="meeting-start" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End</mat-label>
            <input matInput type="time" formControlName="end" data-cy="meeting-end" />
          </mat-form-field>
        </div>
        @if (form.hasError('timeRange')) {
          <p class="error-text" data-cy="time-error">The meeting must end after it starts.</p>
        }
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Location or link</mat-label>
          <mat-icon matIconPrefix>place</mat-icon>
          <input matInput formControlName="location" maxlength="255" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Participants</mat-label>
          <mat-chip-grid #chipGrid aria-label="Participants">
            @for (p of participants; track p) {
              <mat-chip-row (removed)="removeParticipant(p)">
                @if (statusOf(p); as status) { <mat-icon matChipAvatar>{{ icons[status] }}</mat-icon> }
                {{ p }}
                <button matChipRemove [attr.aria-label]="'Remove ' + p"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input placeholder="Name or email, then Enter" [matChipInputFor]="chipGrid"
                   [matChipInputSeparatorKeyCodes]="separators" [matChipInputAddOnBlur]="true"
                   (matChipInputTokenEnd)="addParticipant($event)" data-cy="meeting-participant" />
          </mat-chip-grid>
        </mat-form-field>
        <p class="hint">Participants with a TaskFlow account (same email) see the meeting in their calendar and can accept or decline it.</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Agenda / notes</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (meeting) {
          <button mat-button type="button" class="delete" (click)="remove()" data-cy="meeting-delete">
            <mat-icon>delete_outline</mat-icon> Delete
          </button>
        }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid" data-cy="meeting-save">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; min-width: 0; }
    .row .date { flex: 1.6; }
    .error-text { margin-top: -8px; }
    .hint { margin: -12px 0 16px; font-size: 12px; color: var(--tf-muted); }
    .delete { --mdc-text-button-label-text-color: var(--tf-high); }
    @media (max-width: 520px) { .row { flex-wrap: wrap; } .row .date { flex-basis: 100%; } }
  `],
})
export class MeetingFormDialogComponent {
  private readonly data = inject<MeetingDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<MeetingFormDialogComponent, MeetingDialogResult>);

  readonly meeting = this.data?.meeting ?? null;
  readonly separators = [ENTER, COMMA];
  readonly icons = PARTICIPANT_STATUS_ICONS;
  participants = (this.meeting?.participants ?? []).map((p) => p.participant);

  private readonly start = this.meeting ? parseLocal(this.meeting.startAt) : null;
  private readonly end = this.meeting ? parseLocal(this.meeting.endAt) : null;

  readonly form = inject(FormBuilder).group(
    {
      title: [this.meeting?.title ?? '', [Validators.required, Validators.maxLength(200)]],
      date: [this.start ?? this.data?.date ?? new Date(), Validators.required],
      start: [this.start ? toTime(this.start) : '09:00', Validators.required],
      end: [this.end ? toTime(this.end) : '10:00', Validators.required],
      location: [this.meeting?.location ?? ''],
      description: [this.meeting?.description ?? ''],
    },
    { validators: timeRangeValidator },
  );

  addParticipant(event: MatChipInputEvent): void {
    const value = event.value.trim();
    if (value && !this.participants.includes(value)) {
      this.participants = [...this.participants, value];
    }
    event.chipInput.clear();
  }

  /** Answer of an already-invited TaskFlow user, to show next to their chip. */
  statusOf(participant: string): ParticipantStatus | null {
    const existing = this.meeting?.participants.find((p) => p.participant === participant);
    return existing?.fullName ? existing.status : null;
  }

  removeParticipant(participant: string): void {
    this.participants = this.participants.filter((p) => p !== participant);
  }

  remove(): void {
    this.dialogRef.close('delete');
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      title: v.title!.trim(),
      description: v.description || null,
      location: v.location || null,
      startAt: toLocalDateTime(atTime(v.date!, v.start!)),
      endAt: toLocalDateTime(atTime(v.date!, v.end!)),
      participants: this.participants,
    });
  }
}
