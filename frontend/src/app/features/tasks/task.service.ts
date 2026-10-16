import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';
import { Task, TaskRequest, TaskStatus } from './task.models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/tasks`;

  getAll(): Observable<Task[]> {
    return this.http.get<Task[]>(this.url);
  }

  get(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.url}/${id}`);
  }

  create(request: TaskRequest): Observable<Task> {
    return this.http.post<Task>(this.url, request);
  }

  update(id: number, request: TaskRequest): Observable<Task> {
    return this.http.put<Task>(`${this.url}/${id}`, request);
  }

  updateStatus(id: number, status: TaskStatus): Observable<Task> {
    return this.http.patch<Task>(`${this.url}/${id}/status`, { status });
  }

  toggleChecklistItem(id: number, itemId: number, done: boolean): Observable<Task> {
    return this.http.patch<Task>(`${this.url}/${id}/checklist/${itemId}`, { done });
  }

  /** Follow (or stop following) a task. */
  setWatching(id: number, watching: boolean): Observable<Task> {
    const url = `${this.url}/${id}/watch`;
    return watching ? this.http.put<Task>(url, {}) : this.http.delete<Task>(url);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
