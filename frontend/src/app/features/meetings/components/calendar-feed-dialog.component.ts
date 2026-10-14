import { Component, OnInit, inject, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable } from 'rxjs';
import { errorMessage } from '../../../core/api';
import { MeetingService } from '../meeting.service';

/** Manages the private iCalendar feed URL that Google Calendar / Outlook / Apple Calendar subscribe to. */
@Component({
  selector: 'app-calendar-feed-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Sync with Google Calendar</h2>
    <mat-dialog-content>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <p>
        Subscribe to your TaskFlow meetings from Google Calendar, Outlook or Apple Calendar. Your calendar app
        refreshes the copy on its own (Google: every few hours). Changes go one way, from TaskFlow to your calendar.
      </p>
      @if (url(); as url) {
        <div class="url">
          <code data-cy="feed-url">{{ url }}</code>
          <button mat-icon-button (click)="copy(url)" aria-label="Copy link" data-cy="feed-copy">
            <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
          </button>
        </div>
        <ol>
          <li>In Google Calendar, next to <strong>Other calendars</strong>, click <strong>+</strong> → <strong>From URL</strong>.</li>
          <li>Paste the link and click <strong>Add calendar</strong>.</li>
        </ol>
        <p class="warn"><mat-icon>lock</mat-icon>Anyone with this link can see your meetings. If it leaks, generate a new one.</p>
      } @else if (!loading()) {
        <p class="muted">No subscription link yet.</p>
      }
      @if (error(); as error) { <p class="error-text">{{ error }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (url()) {
        <button mat-button class="danger" (click)="disable()" [disabled]="loading()" data-cy="feed-disable">Turn off</button>
        <button mat-stroked-button (click)="generate()" [disabled]="loading()" data-cy="feed-regenerate">New link</button>
      } @else {
        <button mat-flat-button color="primary" (click)="generate()" [disabled]="loading()" data-cy="feed-create">
          Create link
        </button>
      }
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    p { font-size: 14px; line-height: 1.55; }
    .url {
      display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; border-radius: 10px;
      background: #f1f2f6; border: 1px solid var(--tf-border);
    }
    .url code { flex: 1; min-width: 0; font-size: 12px; word-break: break-all; }
    ol { padding-left: 20px; font-size: 14px; line-height: 1.7; }
    .warn { display: flex; gap: 6px; align-items: flex-start; color: var(--tf-muted); font-size: 13px; }
    .warn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-top: 2px; flex: none; }
    .muted { color: var(--tf-muted); }
    .danger { color: var(--tf-high); }
  `],
})
export class CalendarFeedDialogComponent implements OnInit {
  private readonly meetings = inject(MeetingService);
  private readonly clipboard = inject(Clipboard);
  readonly url = signal<string | null>(null);
  readonly loading = signal(true);
  readonly copied = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.run(this.meetings.getFeed(), (res) => this.url.set(res.url));
  }

  generate(): void {
    this.run(this.meetings.regenerateFeed(), (res) => {
      this.url.set(res.url);
      this.copied.set(false);
    });
  }

  disable(): void {
    this.run(this.meetings.disableFeed(), () => this.url.set(null));
  }

  copy(url: string): void {
    this.copied.set(this.clipboard.copy(url));
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.loading.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        this.loading.set(false);
        onSuccess(value);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
