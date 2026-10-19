import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/api';
import { TaskComment } from './comment.models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);

  getAll(taskId: number): Observable<TaskComment[]> {
    return this.http.get<TaskComment[]>(this.url(taskId));
  }

  /** `mentionedUserIds`: the users picked in the "@" autocomplete; they are notified. */
  create(taskId: number, body: string, mentionedUserIds: number[] = []): Observable<TaskComment> {
    return this.http.post<TaskComment>(this.url(taskId), mentionedUserIds.length ? { body, mentionedUserIds } : { body });
  }

  delete(taskId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.url(taskId)}/${id}`);
  }

  private url(taskId: number): string {
    return `${API_URL}/tasks/${taskId}/comments`;
  }
}
