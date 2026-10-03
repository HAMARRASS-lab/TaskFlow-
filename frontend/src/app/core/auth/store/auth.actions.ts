import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../auth.models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    Login: props<{ request: LoginRequest }>(),
    Register: props<{ request: RegisterRequest }>(),
    'Auth Success': props<{ response: AuthResponse }>(),
    'Auth Failure': props<{ error: string }>(),
    'Session Restored': props<{ user: User }>(),
    Logout: emptyProps(),
  },
});
