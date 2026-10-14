import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';
import { CalendarFeed, Meeting, MeetingRequest, ParticipantStatus } from './meeting.models';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/meetings`;

  /** Meetings overlapping [from, to), both `YYYY-MM-DDTHH:mm:ss` local date-times. */
  getRange(from: string, to: string): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(this.url, { params: { from, to } });
  }

  /** Upcoming meetings shared with me that I have not answered yet. */
  getInvitations(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${this.url}/invitations`);
  }

  respond(id: number, status: Exclude<ParticipantStatus, 'PENDING'>): Observable<Meeting> {
    return this.http.patch<Meeting>(`${this.url}/${id}/response`, { status });
  }

  create(request: MeetingRequest): Observable<Meeting> {
    return this.http.post<Meeting>(this.url, request);
  }

  update(id: number, request: MeetingRequest): Observable<Meeting> {
    return this.http.put<Meeting>(`${this.url}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** The meeting as an iCalendar file (fetched as a blob: the request needs the JWT header). */
  downloadIcs(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/ics`, { responseType: 'blob' });
  }

  /** My private calendar subscription URL, `null` when none is enabled. */
  getFeed(): Observable<CalendarFeed> {
    return this.http.get<CalendarFeed>(`${API_URL}/calendar/feed`);
  }

  /** Creates a new subscription URL; the previous one stops working. */
  regenerateFeed(): Observable<CalendarFeed> {
    return this.http.post<CalendarFeed>(`${API_URL}/calendar/feed`, {});
  }

  disableFeed(): Observable<void> {
    return this.http.delete<void>(`${API_URL}/calendar/feed`);
  }
}
