import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { API_URL } from './api';
import { UserSummary } from '../features/tasks/task.models';

/** Every user (to pick an assignee or watchers), fetched once per session. */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly http = inject(HttpClient);
  private cache$?: Observable<UserSummary[]>;

  users(): Observable<UserSummary[]> {
    // a failed request is not cached, so the next dialog retries
    this.cache$ ??= this.http.get<UserSummary[]>(`${API_URL}/users`).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.cache$;
  }
}
