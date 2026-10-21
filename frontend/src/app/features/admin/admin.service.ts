import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';
import { Task, TaskRequest } from '../tasks/task.models';

export type Role = 'USER' | 'ADMIN';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface UserRequest {
  email: string;
  fullName: string;
  role: Role;
  /** Required on create; empty on update keeps the current password. */
  password: string;
}

export interface ChatResponse {
  reply: string;
}

/** Admin-only endpoints: user management and task assignment. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/admin`;

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.url}/users`);
  }

  createUser(request: UserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.url}/users`, request);
  }

  updateUser(id: number, request: UserRequest): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.url}/users/${id}`, request);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/users/${id}`);
  }

  assignNewTask(userId: number, request: TaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.url}/users/${userId}/tasks`, request);
  }

  /** Gives the task (its ownership) to another user. */
  transferTask(taskId: number, userId: number): Observable<Task> {
    return this.http.patch<Task>(`${this.url}/tasks/${taskId}/owner`, { userId });
  }

  /** Assigns any task to any user; `null` unassigns it. */
  assignTask(taskId: number, userId: number | null): Observable<Task> {
    return this.http.patch<Task>(`${this.url}/tasks/${taskId}/assignee`, { userId });
  }

  /** Asks the admin assistant (chat bot) a question about tasks. */
  chat(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.url}/assistant/chat`, { message });
  }
}
