import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../core/api';
import { AppNotification } from './notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/notifications`;

  /** The latest notifications, newest first. */
  getRecent(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.url);
  }

  unreadCount(): Observable<number> {
    return this.http.get<{ count: number }>(`${this.url}/unread-count`).pipe(map((r) => r.count));
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.url}/read-all`, {});
  }
}
