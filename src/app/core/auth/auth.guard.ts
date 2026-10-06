import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Pas connecté => page de connexion. On garde l'adresse demandée dans « retour »
// (ex : /connexion?retour=%2Frecherche%3Fmetier%3Dplombier) pour y revenir après.
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).session()
    ? true
    : inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
