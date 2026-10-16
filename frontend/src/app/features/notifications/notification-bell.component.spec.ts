import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { MatDialog } from '@angular/material/dialog';
import { MeetingsActions } from '../meetings/store/meetings.actions';
import { NotificationBellComponent } from './notification-bell.component';
import { AppNotification } from './notification.models';

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  let http: HttpTestingController;
  const assigned: AppNotification = {
    id: 1, type: 'TASK_ASSIGNED', actor: { id: 2, fullName: 'Alice' }, taskId: 7, meetingId: null,
    subject: 'Review PR', read: false, createdAt: new Date().toISOString(),
  };
  const invited: AppNotification = {
    id: 2, type: 'MEETING_INVITED', actor: { id: 2, fullName: 'Alice' }, taskId: null, meetingId: 4,
    subject: 'Kickoff', read: true, createdAt: new Date().toISOString(),
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const badge = () => el().querySelector('[data-cy=notifications-badge]');
  const bell = () => fixture.componentInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([]),
        provideMockStore()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    jest.useRealTimers();
  });

  function poll(count: number): void {
    http.expectOne('/api/notifications/unread-count').flush({ count });
    fixture.detectChanges();
  }

  it('polls the unread count and shows it on the badge', () => {
    jest.advanceTimersByTime(0);
    poll(3);
    expect(badge()?.textContent).toBe('3');

    jest.advanceTimersByTime(30_000);
    poll(0);
    expect(badge()).toBeNull();
  });

  it('loads the latest notifications and marks them all read', () => {
    jest.advanceTimersByTime(0);
    poll(1);
    bell().load();
    http.expectOne('/api/notifications').flush([assigned, invited]);
    poll(1);
    expect(bell().items().length).toBe(2);

    bell().markAllRead();
    http.expectOne({ method: 'POST', url: '/api/notifications/read-all' }).flush(null);
    expect(bell().unread()).toBe(0);
    expect(bell().items().every((n) => n.read)).toBe(true);
  });

  it('opens the task of a task notification and marks it read', () => {
    const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({} as never);
    jest.advanceTimersByTime(0);
    poll(1);
    bell().items.set([assigned]);

    bell().open(assigned);

    http.expectOne({ method: 'POST', url: '/api/notifications/1/read' }).flush(null);
    http.expectOne('/api/tasks/7').flush({ id: 7, title: 'Review PR', owner: { id: 2, fullName: 'Alice' } });
    expect(bell().unread()).toBe(0);
    expect(bell().items()[0].read).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ ownerName: 'Alice' }),
    }));
  });

  it('goes to the calendar for a meeting notification', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch');

    bell().open(invited);

    expect(navigate).toHaveBeenCalledWith('/calendar');
    expect(dispatch).toHaveBeenCalledWith(MeetingsActions.loadInvitations());
  });
});
