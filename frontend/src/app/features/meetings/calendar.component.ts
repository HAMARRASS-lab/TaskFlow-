import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { Task } from '../tasks/task.models';
import { TasksActions } from '../tasks/store/tasks.actions';
import { tasksFeature } from '../tasks/store/tasks.reducer';
import { MeetingDialogResult, MeetingFormDialogComponent } from './components/meeting-form-dialog.component';
import { MeetingItemComponent } from './components/meeting-item.component';
import { addDays, addMonths, isSameDay, monthGrid, parseLocal, startOfMonth, toDayKey, toLocalDateTime } from './calendar.utils';
import { Meeting, MeetingDialogData, ParticipantStatus } from './meeting.models';
import { MeetingsActions } from './store/meetings.actions';
import { meetingsFeature } from './store/meetings.reducer';

const MAX_EVENTS_PER_CELL = 3;

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, MeetingItemComponent],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1>Calendar</h1>
          <p>Plan and organize your meetings</p>
        </div>
        <button mat-flat-button color="primary" class="new" (click)="openForm(undefined, selected())" data-cy="new-meeting">
          <mat-icon>add</mat-icon> New meeting
        </button>
      </header>

      <div class="layout">
        <section class="panel calendar">
          <div class="nav">
            <button mat-icon-button (click)="goTo(-1)" aria-label="Previous month" data-cy="prev-month">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <h2 data-cy="month-label">{{ month() | date: 'MMMM yyyy' }}</h2>
            <button mat-icon-button (click)="goTo(1)" aria-label="Next month" data-cy="next-month">
              <mat-icon>chevron_right</mat-icon>
            </button>
            <span class="spacer"></span>
            <button mat-stroked-button (click)="goToday()">Today</button>
          </div>

          @if (loading()) { <mat-progress-bar mode="indeterminate" class="loading" /> }

          <div class="weekdays">
            @for (w of weekdays; track w) { <span>{{ w }}</span> }
          </div>
          <div class="grid">
            @for (day of days(); track day.getTime()) {
              @let key = dayKey(day);
              @let dayMeetings = meetingsByDay().get(key) ?? [];
              @let dayTasks = tasksByDay().get(key) ?? [];
              <div class="day" role="button" tabindex="0"
                   [class.other]="day.getMonth() !== month().getMonth()"
                   [class.today]="isToday(day)"
                   [class.selected]="isSelected(day)"
                   [attr.data-cy]="'day-' + key"
                   (click)="selected.set(day)" (dblclick)="openForm(undefined, day)"
                   (keydown.enter)="selected.set(day)">
                <span class="num">{{ day.getDate() }}</span>
                @for (m of dayMeetings.slice(0, maxEvents); track m.id) {
                  <button class="event" type="button" data-cy="calendar-event"
                          [class.shared]="!m.organizedByMe" [attr.data-answer]="m.myStatus"
                          [matTooltip]="m.organizedByMe ? m.title : m.title + ' — by ' + m.organizer.fullName"
                          (click)="$event.stopPropagation(); openMeeting(m, day)">
                    <span class="time">{{ m.startAt | date: 'HH:mm' }}</span> {{ m.title }}
                  </button>
                }
                @if (dayMeetings.length > maxEvents) {
                  <span class="more">+{{ dayMeetings.length - maxEvents }} more</span>
                }
                @if (dayTasks.length) {
                  <span class="task-flag" [matTooltip]="taskTooltip(dayTasks)">
                    <mat-icon>flag</mat-icon>{{ dayTasks.length }}
                  </span>
                }
              </div>
            }
          </div>
        </section>

        <aside class="panel agenda" data-cy="agenda">
          @if (invitations().length) {
            <section class="invitations" data-cy="invitations">
              <h5><mat-icon>mail</mat-icon> Invitations ({{ invitations().length }})</h5>
              @for (m of invitations(); track m.id) {
                <app-meeting-item [meeting]="m" [showDate]="true" (respond)="respond(m.id, $event)" />
              }
            </section>
          }
          <div class="agenda-head">
            <div>
              <h3>{{ selected() | date: 'EEEE' }}</h3>
              <p>{{ selected() | date: 'MMMM d, yyyy' }}</p>
            </div>
            <button mat-icon-button (click)="openForm(undefined, selected())" aria-label="Add meeting on this day">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          @for (m of selectedMeetings(); track m.id) {
            <app-meeting-item [meeting]="m" (edit)="openForm($event)" (remove)="remove($event)"
                              (respond)="respond(m.id, $event)" />
          } @empty {
            <div class="empty">
              <mat-icon>event_available</mat-icon>
              <p>No meetings this day.</p>
              <button mat-stroked-button (click)="openForm(undefined, selected())"><mat-icon>add</mat-icon> Schedule one</button>
            </div>
          }

          @if (selectedTasks().length) {
            <h5>Tasks due</h5>
            @for (t of selectedTasks(); track t.id) {
              <p class="task" [class.done]="t.status === 'DONE'"><mat-icon>flag</mat-icon>{{ t.title }}</p>
            }
          }
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .head h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
    .head p { margin: 4px 0 0; color: var(--tf-muted); font-size: 14px; }
    .new { height: 42px; padding: 0 18px; }

    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
    .panel {
      background: var(--tf-surface); border: 1px solid var(--tf-border);
      border-radius: var(--tf-radius); box-shadow: var(--tf-shadow);
    }
    .calendar { padding: 12px 14px 14px; position: relative; overflow: hidden; }
    .nav { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
    .nav h2 { margin: 0 6px; font-size: 18px; font-weight: 600; min-width: 150px; text-align: center; }
    .loading { position: absolute; top: 0; left: 0; right: 0; }

    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .weekdays span {
      padding: 6px 8px; font-size: 12px; font-weight: 600; color: var(--tf-muted);
    }
    .grid { border-top: 1px solid var(--tf-border); border-left: 1px solid var(--tf-border); border-radius: 10px; overflow: hidden; }
    .day {
      min-height: 104px; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; gap: 3px;
      border-right: 1px solid var(--tf-border); border-bottom: 1px solid var(--tf-border);
      cursor: pointer; outline: none; transition: background .15s ease;
    }
    .day:focus-visible { box-shadow: inset 0 0 0 2px var(--tf-accent); }
    .day.other { background: #fafafc; }
    .day.other .num { color: #b4b8c5; }
    .day.selected { background: var(--tf-accent-soft); }
    .num {
      align-self: flex-start; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
      font-size: 13px; font-weight: 500;
    }
    .day.today .num { background: var(--tf-accent); color: #fff; font-weight: 600; }

    .event {
      all: unset; box-sizing: border-box; width: 100%; padding: 2px 6px; border-radius: 6px;
      font-size: 12px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      background: #e0e7ff; color: #3730a3; border-left: 3px solid var(--tf-accent); cursor: pointer;
    }
    .event:focus-visible { outline: 2px solid var(--tf-accent); }
    .event .time { font-weight: 600; }
    .event.shared { background: #d1fae5; color: #065f46; border-left-color: var(--tf-done); }
    .event[data-answer='PENDING'] { background: #fff; border: 1px dashed var(--tf-done); border-left-width: 3px; }
    .event[data-answer='DECLINED'] { background: #f1f2f6; color: var(--tf-muted); border-left-color: #b4b8c5; text-decoration: line-through; }
    .more { font-size: 11px; color: var(--tf-muted); padding-left: 4px; }
    .task-flag {
      margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: 2px;
      font-size: 11px; font-weight: 600; color: var(--tf-progress);
    }
    .task-flag mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .agenda { padding: 16px; position: sticky; top: 80px; }
    .agenda-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
    .agenda-head h3 { margin: 0; font-size: 18px; font-weight: 600; }
    .agenda-head p { margin: 2px 0 0; font-size: 13px; color: var(--tf-muted); }
    .empty { text-align: center; padding: 24px 8px; color: var(--tf-muted); border-top: 1px solid var(--tf-border); }
    .empty > mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--tf-accent); }
    .empty p { margin: 6px 0 14px; font-size: 14px; }
    h5 { display: flex; align-items: center; gap: 6px; margin: 16px 0 6px; font-size: 13px; color: var(--tf-muted); }
    .invitations { margin: -16px -16px 16px; padding: 4px 16px; background: #f0fdf4; border-bottom: 1px solid var(--tf-border); border-radius: var(--tf-radius) var(--tf-radius) 0 0; }
    .task { display: flex; align-items: center; gap: 6px; margin: 4px 0; font-size: 14px; }
    h5 mat-icon, .task mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .task mat-icon { color: var(--tf-progress); }
    .task.done { text-decoration: line-through; color: var(--tf-muted); }

    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .agenda { position: static; }
    }
    @media (max-width: 600px) {
      .day { min-height: 64px; padding: 4px; }
      .event { font-size: 0; padding: 0; height: 6px; border-left: 0; background: var(--tf-accent); }
      .more { display: none; }
      .nav h2 { min-width: 0; font-size: 16px; }
      .head h1 { font-size: 24px; }
    }
  `],
})
export class CalendarComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly maxEvents = MAX_EVENTS_PER_CELL;

  readonly month = signal(startOfMonth(new Date()));
  readonly selected = signal(new Date());
  readonly days = computed(() => monthGrid(this.month()));

  readonly loading = this.store.selectSignal(meetingsFeature.selectLoading);
  readonly invitations = this.store.selectSignal(meetingsFeature.selectInvitations);
  private readonly meetings = this.store.selectSignal(meetingsFeature.selectAllMeetings);
  private readonly tasks = this.store.selectSignal(tasksFeature.selectAllTasks);

  /** Meetings grouped by every day they cover (a meeting may span midnight). */
  readonly meetingsByDay = computed(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of this.meetings()) {
      const start = parseLocal(m.startAt);
      // a meeting ending exactly at midnight does not appear on the next day
      const last = new Date(parseLocal(m.endAt).getTime() - 1);
      for (let d = start; toDayKey(d) <= toDayKey(last); d = addDays(d, 1)) {
        const key = toDayKey(d);
        map.set(key, [...(map.get(key) ?? []), m]);
      }
    }
    return map;
  });

  readonly tasksByDay = computed(() => {
    const map = new Map<string, Task[]>();
    for (const t of this.tasks()) {
      if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    }
    return map;
  });

  readonly selectedMeetings = computed(() => this.meetingsByDay().get(toDayKey(this.selected())) ?? []);
  readonly selectedTasks = computed(() => this.tasksByDay().get(toDayKey(this.selected())) ?? []);

  ngOnInit(): void {
    this.load();
    this.store.dispatch(MeetingsActions.loadInvitations());
    if (!this.tasks().length) this.store.dispatch(TasksActions.load());
  }

  dayKey(day: Date): string {
    return toDayKey(day);
  }

  isToday(day: Date): boolean {
    return isSameDay(day, new Date());
  }

  isSelected(day: Date): boolean {
    return isSameDay(day, this.selected());
  }

  taskTooltip(tasks: Task[]): string {
    return 'Due: ' + tasks.map((t) => t.title).join(', ');
  }

  goTo(offset: number): void {
    this.month.set(addMonths(this.month(), offset));
    this.selected.set(this.month());
    this.load();
  }

  goToday(): void {
    const today = new Date();
    this.selected.set(today);
    if (!isSameDay(startOfMonth(today), this.month())) {
      this.month.set(startOfMonth(today));
      this.load();
    }
  }

  /** The organizer edits the meeting; an invitee sees its details (and answers) in the day panel. */
  openMeeting(meeting: Meeting, day: Date): void {
    if (meeting.organizedByMe) {
      this.openForm(meeting);
    } else {
      this.selected.set(day);
    }
  }

  respond(id: number, status: Exclude<ParticipantStatus, 'PENDING'>): void {
    this.store.dispatch(MeetingsActions.respond({ id, status }));
  }

  remove(id: number): void {
    this.store.dispatch(MeetingsActions.delete({ id }));
  }

  openForm(meeting?: Meeting, date?: Date): void {
    this.dialog
      .open<MeetingFormDialogComponent, MeetingDialogData, MeetingDialogResult>(MeetingFormDialogComponent, {
        data: { meeting, date },
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(filter((result): result is MeetingDialogResult => !!result))
      .subscribe((result) => {
        if (result === 'delete') {
          this.remove(meeting!.id);
        } else if (meeting) {
          this.store.dispatch(MeetingsActions.update({ id: meeting.id, request: result }));
        } else {
          this.store.dispatch(MeetingsActions.create({ request: result }));
        }
      });
  }

  /** Loads the meetings covering the whole visible grid (including the adjacent months' days). */
  private load(): void {
    const days = this.days();
    this.store.dispatch(MeetingsActions.load({
      from: toLocalDateTime(days[0]),
      to: toLocalDateTime(addDays(days[days.length - 1], 1)),
    }));
  }
}
