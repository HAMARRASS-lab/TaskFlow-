import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};

/** Admin pages; the backend enforces the role too. */
export const adminGuard: CanActivateFn = () => {
  const session = inject(AuthService).getSession();
  if (!session) return inject(Router).createUrlTree(['/login']);
  return session.user.role === 'ADMIN' || inject(Router).createUrlTree(['/tasks']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || inject(Router).createUrlTree(['/tasks']);
};
