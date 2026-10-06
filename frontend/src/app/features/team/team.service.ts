import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';
import { Task, TaskStatus } from '../tasks/task.models';

export interface TaskOwner {
  id: number;
  fullName: string;
  email: string;
  todo: number;
  inProgress: number;
  done: number;
  total: number;
}

/** Read-only access to the tasks of every user. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/users`;

  getOwners(): Observable<TaskOwner[]> {
    return this.http.get<TaskOwner[]>(`${this.url}/task-owners`);
  }

  getTasks(userId: number, status?: TaskStatus): Observable<Task[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<Task[]>(`${this.url}/${userId}/tasks`, { params });
  }
}
