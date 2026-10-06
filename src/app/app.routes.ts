import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

// Écran provisoire « Bientôt disponible » : chaque page le remplacera (F2, F3, F4…)
const aVenir = () => import('./features/a-venir/a-venir').then((m) => m.AVenir);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },

  // 1. Pages publiques (mise en page AuthLayout) : connexion, inscription, mot de passe oublié
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
      {
        path: 'mot-de-passe-oublie',
        title: 'Mot de passe oublié | Sen Proxi Teranga',
        loadComponent: () =>
          import('./features/auth/mot-de-passe-oublie/mot-de-passe-oublie').then(
            (m) => m.MotDePasseOublie,
          ),
      },
    ],
  },

  // 2. Pages connectées (mise en page AppLayout : en-tête + menu selon le rôle)
  //    authGuard : il faut être connecté ; roleGuard : il faut avoir le bon rôle
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layouts/app-layout/app-layout').then((m) => m.AppLayout),
    children: [
      // Tous les rôles
      {
        path: 'espace',
        title: 'Mon compte | Sen Proxi Teranga',
        loadComponent: () => import('./features/account/account').then((m) => m.Account),
      },

      // Client et professionnel
      {
        path: 'messages',
        title: 'Messages | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT', 'PROFESSIONNEL')],
        data: { titre: 'Messages' },
        loadComponent: aVenir,
      },
      {
        path: 'notifications',
        title: 'Notifications | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT', 'PROFESSIONNEL')],
        data: { titre: 'Notifications' },
        loadComponent: aVenir,
      },

      // Client
      {
        path: 'recherche',
        title: 'Trouver un pro | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        loadComponent: () =>
          import('./features/professionnels/pages/recherche/recherche').then((m) => m.Recherche),
      },
      {
        // Provisoire : la page du profil arrive à l'étape F3-b
        path: 'professionnels/:id',
        title: 'Profil du professionnel | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        data: { titre: 'Profil du professionnel' },
        loadComponent: aVenir,
      },
      {
        path: 'mes-demandes',
        title: 'Mes demandes | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        data: { titre: 'Mes demandes' },
        loadComponent: aVenir,
      },

      // Professionnel
      {
        path: 'demandes-recues',
        title: 'Demandes reçues | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        data: { titre: 'Demandes reçues' },
        loadComponent: aVenir,
      },
      {
        path: 'mes-services',
        title: 'Mes services | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        data: { titre: 'Mes services' },
        loadComponent: aVenir,
      },
      {
        path: 'mon-profil',
        title: 'Mon profil | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        data: { titre: 'Mon profil professionnel' },
        loadComponent: aVenir,
      },

      // Administrateur
      {
        path: 'admin',
        title: 'Tableau de bord | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        data: { titre: 'Tableau de bord' },
        loadComponent: aVenir,
      },
      {
        path: 'admin/professionnels',
        title: 'Professionnels | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        data: { titre: 'Vérification des professionnels' },
        loadComponent: aVenir,
      },
      {
        path: 'admin/litiges',
        title: 'Litiges | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        data: { titre: 'Litiges' },
        loadComponent: aVenir,
      },
    ],
  },

  // 3. Page publique sans mise en page
  {
    path: 'conditions',
    title: 'Conditions | Sen Proxi Teranga',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
  },

  // Adresse inconnue => retour à la connexion
  { path: '**', redirectTo: 'connexion' },
];
