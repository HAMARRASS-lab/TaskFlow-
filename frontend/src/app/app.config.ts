import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { authFeature } from './core/auth/store/auth.reducer';
import * as authEffects from './core/auth/store/auth.effects';
import { tasksFeature } from './features/tasks/store/tasks.reducer';
import * as tasksEffects from './features/tasks/store/tasks.effects';
import { meetingsFeature } from './features/meetings/store/meetings.reducer';
import * as meetingsEffects from './features/meetings/store/meetings.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideStore({
      [authFeature.name]: authFeature.reducer,
      [tasksFeature.name]: tasksFeature.reducer,
      [meetingsFeature.name]: meetingsFeature.reducer,
    }),
    provideEffects(authEffects, tasksEffects, meetingsEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
