import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { errorMessage } from '../../../core/api';
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
      mergeMap(({ id, status }) =>
        api.updateStatus(id, status).pipe(map((task) => TasksActions.updateSuccess({ task })), catchError(failure)),
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

export const showError$ = createEffect(
  (actions$ = inject(Actions), snackBar = inject(MatSnackBar)) =>
    actions$.pipe(
      ofType(TasksActions.requestFailure),
      tap(({ error }) => snackBar.open(error, 'Close', { duration: 4000 })),
    ),
  { functional: true, dispatch: false },
);
