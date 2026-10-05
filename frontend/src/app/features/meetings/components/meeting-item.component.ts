import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Meeting, PARTICIPANT_STATUS_ICONS, PARTICIPANT_STATUS_LABELS, ParticipantStatus } from '../meeting.models';

/** One meeting in the agenda: details, plus edit/delete for the organizer or accept/decline for an invitee. */
@Component({
  selector: 'app-meeting-item',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <article class="meeting" [class.declined]="meeting.myStatus === 'DECLINED'" data-cy="agenda-meeting">
      <div class="slot">
        @if (showDate) { <span class="date">{{ meeting.startAt | date: 'MMM d' }}</span> }
        <strong>{{ meeting.startAt | date: 'HH:mm' }}</strong>
        <span>{{ meeting.endAt | date: 'HH:mm' }}</span>
      </div>
      <div class="info">
        <h4>{{ meeting.title }}</h4>
        @if (!meeting.organizedByMe) {
          <p class="meta" data-cy="meeting-organizer"><mat-icon>person</mat-icon>By {{ meeting.organizer.fullName }}</p>
        }
        @if (meeting.location) { <p class="meta"><mat-icon>place</mat-icon>{{ meeting.location }}</p> }
        @if (meeting.participants.length) {
          <ul class="people">
            @for (p of meeting.participants; track p.participant) {
              <li [attr.data-status]="p.status" [matTooltip]="p.fullName ? labels[p.status] : 'No TaskFlow account'">
                <mat-icon>{{ p.fullName ? icons[p.status] : 'person_outline' }}</mat-icon>{{ p.fullName ?? p.participant }}
              </li>
            }
          </ul>
        }
        @if (meeting.description) { <p class="desc">{{ meeting.description }}</p> }
        @if (!meeting.organizedByMe) {
          <div class="answer">
            <button mat-stroked-button [class.on]="meeting.myStatus === 'ACCEPTED'" (click)="respond.emit('ACCEPTED')"
                    data-cy="meeting-accept"><mat-icon>check</mat-icon> Accept</button>
            <button mat-stroked-button [class.on]="meeting.myStatus === 'DECLINED'" (click)="respond.emit('DECLINED')"
                    data-cy="meeting-decline"><mat-icon>close</mat-icon> Decline</button>
          </div>
        }
      </div>
      @if (meeting.organizedByMe) {
        <div class="actions">
          <button mat-icon-button (click)="edit.emit(meeting)" aria-label="Edit meeting"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button class="delete" (click)="remove.emit(meeting.id)" aria-label="Delete meeting">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      }
    </article>
  `,
  styles: [`
    .meeting { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--tf-border); }
    .meeting.declined h4 { text-decoration: line-through; color: var(--tf-muted); }
    .slot { display: flex; flex-direction: column; min-width: 44px; font-size: 13px; color: var(--tf-muted); }
    .slot strong { color: var(--tf-text); }
    .slot .date { font-size: 11px; font-weight: 600; color: var(--tf-accent); }
    .info { flex: 1; min-width: 0; }
    .info h4 { margin: 0 0 4px; font-size: 15px; font-weight: 600; word-break: break-word; }
    .meta { display: flex; align-items: flex-start; gap: 4px; margin: 2px 0; font-size: 13px; color: var(--tf-muted); word-break: break-word; }
    mat-icon { font-size: 16px; width: 16px; height: 16px; flex: none; }
    .meta mat-icon { margin-top: 1px; }
    .people { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
    .people li {
      display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px 2px 5px; border-radius: 99px;
      font-size: 12px; background: #f1f2f6; color: var(--tf-text); word-break: break-all;
    }
    .people li[data-status='ACCEPTED'] mat-icon { color: var(--tf-done); }
    .people li[data-status='DECLINED'] mat-icon { color: var(--tf-high); }
    .people li[data-status='PENDING'] mat-icon { color: var(--tf-progress); }
    .desc { margin: 6px 0 0; font-size: 13px; line-height: 1.5; white-space: pre-line; }
    .answer { display: flex; gap: 6px; margin-top: 8px; }
    .answer button { height: 30px; padding: 0 10px; font-size: 13px; }
    .answer button.on { background: var(--tf-accent-soft); border-color: var(--tf-accent); color: var(--tf-accent); }
    .actions { display: flex; flex-direction: column; }
    .actions button { --mdc-icon-button-state-layer-size: 32px; padding: 4px; color: #9aa0b1; }
    .actions mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .actions .delete:hover { color: var(--tf-high); }
  `],
})
export class MeetingItemComponent {
  @Input({ required: true }) meeting!: Meeting;
  /** Show the day too (for lists spanning several days, like invitations). */
  @Input() showDate = false;
  @Output() edit = new EventEmitter<Meeting>();
  @Output() remove = new EventEmitter<number>();
  @Output() respond = new EventEmitter<Exclude<ParticipantStatus, 'PENDING'>>();

  readonly labels = PARTICIPANT_STATUS_LABELS;
  readonly icons = PARTICIPANT_STATUS_ICONS;
}
