import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api';
import { AuthResponse, LoginRequest, RegisterRequest, StoredSession } from './auth.models';

const STORAGE_KEY = 'taskflow.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, request);
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, request);
  }

  saveSession(response: AuthResponse): void {
    const session: StoredSession = {
      token: response.token,
      expiresAt: Date.now() + response.expiresIn,
      user: response.user,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Returns the stored session if present and not expired. */
  getSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as StoredSession;
      if (session.expiresAt <= Date.now()) {
        this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return this.getSession()?.token ?? null;
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
}
