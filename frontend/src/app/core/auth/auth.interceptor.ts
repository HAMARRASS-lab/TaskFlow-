import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthActions } from './store/auth.actions';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const store = inject(Store);
  const token = auth.token;
  const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/register');

  const request = token && !isAuthCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthCall) {
        store.dispatch(AuthActions.logout());
      }
      return throwError(() => error);
    }),
  );
};
