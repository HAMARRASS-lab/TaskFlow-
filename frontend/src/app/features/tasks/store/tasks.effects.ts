import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, exhaustMap, filter, map, mergeMap, of, tap, withLatestFrom } from 'rxjs';
import { errorMessage } from '../../../core/api';
import { authFeature } from '../../../core/auth/store/auth.reducer';
import { isOnBoardOf } from '../task.models';
import { TaskService } from '../task.service';
import { TasksActions } from './tasks.actions';

const failure = (error: unknown) => of(TasksActions.requestFailure({ error: errorMessage(error) }));

export const loadTasks$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.load),
      exhaustMap(() => api.getAll().pipe(map((tasks) => TasksActions.loadSuccess({ tasks })), catchError(failure))),
    ),
  { functional: true },
);

export const createTask$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.create),
      concatMap(({ request }) =>
        api.create(request).pipe(map((task) => TasksActions.createSuccess({ task })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const updateTask$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.update),
      concatMap(({ id, request }) =>
        api.update(id, request).pipe(map((task) => TasksActions.updateSuccess({ task })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const changeStatus$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.changeStatus),
      mergeMap(({ id, status, from }) =>
        api.updateStatus(id, status).pipe(
          map((task) => TasksActions.updateSuccess({ task })),
          catchError((error) => of(TasksActions.changeStatusFailure({ id, status: from, error: errorMessage(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const toggleChecklistItem$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.toggleChecklistItem),
      mergeMap(({ id, itemId, done }) =>
        api.toggleChecklistItem(id, itemId, done).pipe(
          map((task) => TasksActions.updateSuccess({ task })),
          catchError((error) =>
            of(TasksActions.toggleChecklistItemFailure({ id, itemId, done: !done, error: errorMessage(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const deleteTask$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.delete),
      mergeMap(({ id }) =>
        api.delete(id).pipe(map(() => TasksActions.deleteSuccess({ id })), catchError(failure)),
      ),
    ),
  { functional: true },
);

export const unwatchTask$ = createEffect(
  (actions$ = inject(Actions), api = inject(TaskService)) =>
    actions$.pipe(
      ofType(TasksActions.unwatch),
      mergeMap(({ id }) =>
        api.setWatching(id, false).pipe(map(() => TasksActions.leftBoard({ id })), catchError(failure)),
      ),
    ),
  { functional: true },
);

/** After an edit (e.g. the assignee unassigned themselves), a task that no longer concerns the user leaves the board. */
export const leaveBoard$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(TasksActions.updateSuccess),
      withLatestFrom(store.select(authFeature.selectUser)),
      filter(([{ task }, user]) => !!user && !isOnBoardOf(task, user.id)),
      map(([{ task }]) => TasksActions.leftBoard({ id: task.id })),
    ),
  { functional: true },
);

export const showError$ = createEffect(
  (actions$ = inject(Actions), snackBar = inject(MatSnackBar)) =>
    actions$.pipe(
      ofType(TasksActions.requestFailure, TasksActions.changeStatusFailure, TasksActions.toggleChecklistItemFailure),
      tap(({ error }) => snackBar.open(error, 'Close', { duration: 4000 })),
    ),
  { functional: true, dispatch: false },
);
