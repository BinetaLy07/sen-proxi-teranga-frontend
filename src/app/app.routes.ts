import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  {
    path: '',
    loadComponent: () =>
      import('./shared/layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'connexion',
        title: 'Connexion | Sen Proxi Teranga',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'inscription',
        title: 'Créer un compte | Sen Proxi Teranga',
        loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
      },
    ],
  },
  {
    path: 'espace',
    title: 'Mon espace | Sen Proxi Teranga',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/account').then((m) => m.Account),
  },
  {
    path: 'conditions',
    title: 'Conditions | Sen Proxi Teranga',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
  },
  { path: '**', redirectTo: 'connexion' },
];
