import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { User } from '../auth.models';
import { AuthActions } from './auth.actions';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = { user: null, loading: false, error: null };

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialAuthState,
    on(AuthActions.login, AuthActions.register, (state) => ({ ...state, loading: true, error: null })),
    on(AuthActions.authSuccess, (state, { response }) => ({ user: response.user, loading: false, error: null })),
    on(AuthActions.authFailure, (state, { error }) => ({ ...state, loading: false, error })),
    on(AuthActions.sessionRestored, (state, { user }) => ({ ...state, user })),
    on(AuthActions.logout, () => initialAuthState),
  ),
  extraSelectors: ({ selectUser }) => ({
    selectIsAuthenticated: createSelector(selectUser, (user) => user !== null),
  }),
});
