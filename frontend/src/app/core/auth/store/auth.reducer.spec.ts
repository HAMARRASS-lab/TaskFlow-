import { AuthActions } from './auth.actions';
import { authFeature, initialAuthState } from './auth.reducer';

describe('auth reducer', () => {
  const user = { id: 1, email: 'a@test.com', fullName: 'Alice', role: 'USER' as const };

  it('sets loading on login', () => {
    const state = authFeature.reducer(initialAuthState, AuthActions.login({ request: { email: 'a', password: 'b' } }));
    expect(state.loading).toBe(true);
  });

  it('stores the user on success', () => {
    const state = authFeature.reducer(
      { ...initialAuthState, loading: true },
      AuthActions.authSuccess({ response: { token: 't', expiresIn: 1, user } }),
    );
    expect(state).toEqual({ user, loading: false, error: null });
    expect(authFeature.selectIsAuthenticated({ auth: state })).toBe(true);
  });

  it('stores the error on failure', () => {
    const state = authFeature.reducer(initialAuthState, AuthActions.authFailure({ error: 'Invalid' }));
    expect(state.error).toBe('Invalid');
  });

  it('clears everything on logout', () => {
    expect(authFeature.reducer({ user, loading: false, error: null }, AuthActions.logout())).toEqual(initialAuthState);
  });
});
