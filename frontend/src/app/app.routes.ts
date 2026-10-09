import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tasks/task-board.component').then((m) => m.TaskBoardComponent),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./features/meetings/calendar.component').then((m) => m.CalendarComponent),
  },
  {
    path: 'team',
    canActivate: [authGuard],
    loadComponent: () => import('./features/team/team.component').then((m) => m.TeamComponent),
  },
  {
    path: 'team/:userId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/team/team.component').then((m) => m.TeamComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-users.component').then((m) => m.AdminUsersComponent),
  },
  { path: '**', redirectTo: 'tasks' },
];
