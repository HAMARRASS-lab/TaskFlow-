import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '../../core/api';
import { MeetingsActions } from '../meetings/store/meetings.actions';
import { TaskService } from '../tasks/task.service';
import { TaskDetailData, TaskDetailDialogComponent } from '../team/task-detail-dialog.component';
import { AppNotification, NOTIFICATION_ICONS, describeNotification, timeAgo } from './notification.models';
import { NotificationService } from './notification.service';

/** How often the unread count is refreshed. */
export const NOTIFICATION_POLL_MS = 30_000;

/** The toolbar bell: unread count, and a menu of the latest notifications that lead to their task or meeting. */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-icon-button class="bell" [matMenuTriggerFor]="menu" (menuOpened)="load()"
            [attr.aria-label]="unread() ? 'Notifications, ' + unread() + ' unread' : 'Notifications'"
            data-cy="notifications-bell">
      <mat-icon>{{ unread() ? 'notifications_active' : 'notifications_none' }}</mat-icon>
      @if (unread()) {
        <span class="badge" aria-hidden="true" data-cy="notifications-badge">{{ unread() > 99 ? '99+' : unread() }}</span>
      }
    </button>
    <mat-menu #menu="matMenu" xPosition="before" class="tf-notifications-menu">
      <div class="head" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <strong>Notifications</strong>
        @if (unread()) {
          <button mat-button type="button" (click)="markAllRead()" data-cy="notifications-read-all">Mark all as read</button>
        }
      </div>
      @if (loading() && !items().length) {
        <p class="empty">Loading…</p>
      } @else {
        @for (n of items(); track n.id) {
          <button mat-menu-item class="item" [class.unread]="!n.read" (click)="open(n)" data-cy="notification">
            <mat-icon>{{ icons[n.type] }}</mat-icon>
            <span class="text">
              <span class="line">{{ describe(n) }} <strong>{{ n.subject }}</strong></span>
              <time [attr.datetime]="n.createdAt">{{ ago(n.createdAt) }}</time>
            </span>
            @if (!n.read) { <span class="dot" aria-label="unread"></span> }
          </button>
        } @empty {
          <p class="empty" data-cy="notifications-empty">You're all caught up.</p>
        }
      }
    </mat-menu>
  `,
  styles: [`
    :host { position: relative; display: inline-block; }
    .bell { color: var(--tf-muted); }
    .badge {
      position: absolute; top: 4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
      border-radius: 99px; text-align: center; line-height: 18px; font-size: 11px; font-weight: 700;
      background: var(--tf-high); color: #fff; pointer-events: none;
    }
    .head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 4px 8px 8px 16px; border-bottom: 1px solid var(--tf-border); font-size: 14px;
    }
    .empty { margin: 0; padding: 20px 16px; color: var(--tf-muted); font-size: 14px; text-align: center; }
    .item { height: auto; min-height: 56px; padding-top: 8px; padding-bottom: 8px; }
    .item mat-icon { align-self: flex-start; margin-top: 2px; color: var(--tf-muted); }
    .item.unread { background: var(--tf-accent-soft); }
    .item.unread mat-icon { color: var(--tf-accent); }
    .text { display: flex; flex-direction: column; gap: 2px; white-space: normal; line-height: 1.35; font-size: 14px; }
    .line strong { font-weight: 600; }
    time { color: var(--tf-muted); font-size: 12px; }
    .dot { position: absolute; right: 12px; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 50%; background: var(--tf-accent); }
  `],
})
export class NotificationBellComponent implements OnInit {
  private readonly api = inject(NotificationService);
  private readonly tasks = inject(TaskService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly unread = signal(0);
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly icons = NOTIFICATION_ICONS;
  readonly describe = describeNotification;

  ngOnInit(): void {
    timer(0, NOTIFICATION_POLL_MS)
      .pipe(
        // a failed poll (server restarting…) just waits for the next one
        switchMap(() => this.api.unreadCount().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((count) => this.unread.set(count));
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }

  load(): void {
    this.loading.set(true);
    this.api.getRecent().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 });
      },
    });
    this.api.unreadCount().subscribe({ next: (count) => this.unread.set(count), error: () => undefined });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe({
      next: () => {
        this.items.update((items) => items.map((n) => ({ ...n, read: true })));
        this.unread.set(0);
      },
      error: (e) => this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 }),
    });
  }

  /** Marks it read and goes to its task (detail dialog) or meeting (calendar). */
  open(n: AppNotification): void {
    if (!n.read) {
      this.items.update((items) => items.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      this.unread.update((count) => Math.max(0, count - 1));
      this.api.markRead(n.id).subscribe({ error: () => undefined });
    }
    if (n.taskId != null) {
      this.tasks.get(n.taskId).subscribe({
        next: (task) =>
          this.dialog.open<TaskDetailDialogComponent, TaskDetailData>(TaskDetailDialogComponent, {
            data: { task, ownerName: task.owner.fullName },
            width: '520px',
            maxWidth: '95vw',
          }),
        error: (e) => this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 }),
      });
    } else if (n.meetingId != null) {
      this.store.dispatch(MeetingsActions.loadInvitations());
      this.router.navigateByUrl('/calendar');
    }
  }
}
