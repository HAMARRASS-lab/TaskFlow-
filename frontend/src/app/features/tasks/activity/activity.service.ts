import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api';
import { TaskEvent } from './activity.models';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

  /** Oldest first. */
  getAll(taskId: number): Observable<TaskEvent[]> {
    return this.http.get<TaskEvent[]>(`${API_URL}/tasks/${taskId}/activity`);
  }
}
