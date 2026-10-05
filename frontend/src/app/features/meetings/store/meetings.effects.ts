import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, of, switchMap, tap } from 'rxjs';
import { errorMessage } from '../../../core/api';
import { AuthActions } from '../../../core/auth/store/auth.actions';
import { MeetingService } from '../meeting.service';
import { MeetingsActions } from './meetings.actions';

const failure = (error: unknown) => of(MeetingsActions.requestFailure({ error: errorMessage(error) }));

export const loadMeetings$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.load),
      switchMap(({ from, to }) =>
        api.getRange(from, to).pipe(map((meetings) => MeetingsActions.loadSuccess({ meetings })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const createMeeting$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.create),
      concatMap(({ request }) =>
        api.create(request).pipe(map((meeting) => MeetingsActions.createSuccess({ meeting })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const updateMeeting$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.update),
      concatMap(({ id, request }) =>
        api.update(id, request).pipe(map((meeting) => MeetingsActions.updateSuccess({ meeting })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const deleteMeeting$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.delete),
      mergeMap(({ id }) =>
        api.delete(id).pipe(map(() => MeetingsActions.deleteSuccess({ id })), catchError(failure)),
      ),
    ),
  { functional: true },
);

/** Invitations are loaded as soon as a user is known, so the navigation badge is up to date. */
export const loadInvitations$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.loadInvitations, AuthActions.authSuccess, AuthActions.sessionRestored),
      switchMap(() =>
        api.getInvitations().pipe(
          map((invitations) => MeetingsActions.loadInvitationsSuccess({ invitations })),
          catchError(failure),
        ),
      ),
    ),
  { functional: true },
);

export const respond$ = createEffect(
  (actions$ = inject(Actions), api = inject(MeetingService)) =>
    actions$.pipe(
      ofType(MeetingsActions.respond),
      concatMap(({ id, status }) =>
        api.respond(id, status).pipe(map((meeting) => MeetingsActions.respondSuccess({ meeting })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const showError$ = createEffect(
  (actions$ = inject(Actions), snackBar = inject(MatSnackBar)) =>
    actions$.pipe(
      ofType(MeetingsActions.requestFailure),
      tap(({ error }) => snackBar.open(error, 'Close', { duration: 5000 })),
    ),
  { functional: true, dispatch: false },
);
