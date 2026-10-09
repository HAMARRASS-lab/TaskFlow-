import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, catchError, exhaustMap, filter, map, of, tap } from 'rxjs';
import { errorMessage } from '../../api';
import { AuthService } from '../auth.service';
import { AuthActions } from './auth.actions';

export const restoreSession$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => auth.getSession()),
      filter((session) => session !== null),
      map((session) => AuthActions.sessionRestored({ user: session!.user })),
    ),
  { functional: true },
);

/** Refreshes the cached user (role, name) from the server after a session is restored. */
export const refreshUser$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      filter(() => auth.isAuthenticated()),
      exhaustMap(() =>
        auth.me().pipe(
          tap((user) => auth.updateStoredUser(user)),
          map((user) => AuthActions.sessionRestored({ user })),
          catchError(() => EMPTY),
        ),
      ),
    ),
  { functional: true },
);

export const login$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService)) =>
    actions$.pipe(
      ofType(AuthActions.login),
      exhaustMap(({ request }) =>
        auth.login(request).pipe(
          map((response) => AuthActions.authSuccess({ response })),
          catchError((error) => of(AuthActions.authFailure({ error: errorMessage(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const register$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService)) =>
    actions$.pipe(
      ofType(AuthActions.register),
      exhaustMap(({ request }) =>
        auth.register(request).pipe(
          map((response) => AuthActions.authSuccess({ response })),
          catchError((error) => of(AuthActions.authFailure({ error: errorMessage(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const authSuccess$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.authSuccess),
      tap(({ response }) => {
        auth.saveSession(response);
        router.navigate(['/tasks']);
      }),
    ),
  { functional: true, dispatch: false },
);

export const logout$ = createEffect(
  (actions$ = inject(Actions), auth = inject(AuthService), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.logout),
      tap(() => {
        auth.clearSession();
        router.navigate(['/login']);
      }),
    ),
  { functional: true, dispatch: false },
);
