import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api';
import { TimeSummary } from './time.models';

/** Every call answers with the task's updated time summary. */
@Injectable({ providedIn: 'root' })
export class TimeService {
  private readonly http = inject(HttpClient);

  get(taskId: number): Observable<TimeSummary> {
    return this.http.get<TimeSummary>(this.url(taskId));
  }

  /** Also stops the timer the user may have running on another task. */
  start(taskId: number): Observable<TimeSummary> {
    return this.http.post<TimeSummary>(`${this.url(taskId)}/start`, null);
  }

  stop(taskId: number): Observable<TimeSummary> {
    return this.http.post<TimeSummary>(`${this.url(taskId)}/stop`, null);
  }

  log(taskId: number, minutes: number, note: string | null): Observable<TimeSummary> {
    return this.http.post<TimeSummary>(`${this.url(taskId)}/entries`, { minutes, note });
  }

  delete(taskId: number, entryId: number): Observable<TimeSummary> {
    return this.http.delete<TimeSummary>(`${this.url(taskId)}/entries/${entryId}`);
  }

  /** `null` removes the estimate. */
  setEstimate(taskId: number, minutes: number | null): Observable<TimeSummary> {
    return this.http.put<TimeSummary>(`${this.url(taskId)}/estimate`, { minutes });
  }

  private url(taskId: number): string {
    return `${API_URL}/tasks/${taskId}/time`;
  }
}
