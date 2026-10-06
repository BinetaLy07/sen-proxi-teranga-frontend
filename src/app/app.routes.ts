import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  // 0. La page d'accueil publique (avec sa propre mise en page)
  {
    path: '',
    pathMatch: 'full',
    title: 'Sen Proxi Teranga | Services de proximité',
    loadComponent: () => import('./features/accueil/accueil').then((m) => m.Accueil),
  },

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
        loadComponent: () =>
          import('./features/messages/pages/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'notifications',
        title: 'Notifications | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT', 'PROFESSIONNEL')],
        loadComponent: () =>
          import('./features/notifications/pages/notifications/notifications').then(
            (m) => m.Notifications,
          ),
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
        path: 'professionnels/:id',
        title: 'Profil du professionnel | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        loadComponent: () =>
          import('./features/professionnels/pages/profil/profil').then((m) => m.Profil),
      },
      {
        path: 'favoris',
        title: 'Mes favoris | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        loadComponent: () =>
          import('./features/favoris/pages/mes-favoris/mes-favoris').then((m) => m.MesFavoris),
      },
      {
        path: 'mes-demandes',
        title: 'Mes demandes | Sen Proxi Teranga',
        canActivate: [roleGuard('CLIENT')],
        loadComponent: () =>
          import('./features/demandes/pages/mes-demandes/mes-demandes').then((m) => m.MesDemandes),
      },

      // Professionnel
      {
        path: 'demandes-recues',
        title: 'Demandes reçues | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        loadComponent: () =>
          import('./features/demandes/pages/demandes-recues/demandes-recues').then(
            (m) => m.DemandesRecues,
          ),
      },
      {
        path: 'mes-services',
        title: 'Mes services | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        loadComponent: () =>
          import('./features/services/pages/mes-services/mes-services').then((m) => m.MesServices),
      },
      {
        path: 'mon-profil',
        title: 'Mon profil | Sen Proxi Teranga',
        canActivate: [roleGuard('PROFESSIONNEL')],
        loadComponent: () =>
          import('./features/professionnels/pages/mon-profil/mon-profil').then((m) => m.MonProfil),
      },

      // Administrateur
      {
        path: 'admin',
        title: 'Tableau de bord | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        loadComponent: () =>
          import('./features/admin/pages/tableau-de-bord/tableau-de-bord').then(
            (m) => m.TableauDeBord,
          ),
      },
      {
        path: 'admin/professionnels',
        title: 'Professionnels | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        loadComponent: () =>
          import('./features/admin/pages/verification-pros/verification-pros').then(
            (m) => m.VerificationPros,
          ),
      },
      {
        path: 'admin/litiges',
        title: 'Litiges | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        loadComponent: () =>
          import('./features/admin/pages/litiges/litiges').then((m) => m.Litiges),
      },
      {
        path: 'admin/comptes',
        title: 'Comptes | Sen Proxi Teranga',
        canActivate: [roleGuard('ADMINISTRATEUR')],
        loadComponent: () =>
          import('./features/admin/pages/comptes/comptes').then((m) => m.Comptes),
      },
    ],
  },

  // 3. Page publique sans mise en page
  {
    path: 'conditions',
    title: 'Conditions | Sen Proxi Teranga',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
  },

  // Adresse inconnue => retour à l'accueil
  { path: '**', redirectTo: '' },
];
