import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthResponse } from './auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const response: AuthResponse = {
    token: 'jwt',
    expiresIn: 60_000,
    user: { id: 1, email: 'a@test.com', fullName: 'Alice', role: 'USER' },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts credentials to /api/auth/login', () => {
    service.login({ email: 'a@test.com', password: 'secret123' }).subscribe((res) => expect(res).toEqual(response));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(response);
  });

  it('persists and restores the session', () => {
    expect(service.isAuthenticated()).toBe(false);
    service.saveSession(response);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.token).toBe('jwt');
    service.clearSession();
    expect(service.getSession()).toBeNull();
  });

  it('treats expired sessions as logged out', () => {
    service.saveSession({ ...response, expiresIn: -1 });
    expect(service.isAuthenticated()).toBe(false);
  });
});
