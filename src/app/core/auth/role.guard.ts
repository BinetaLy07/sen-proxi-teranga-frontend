import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from './auth.models';
import { AuthService } from './auth.service';

// Réserve une page à certains rôles. C'est du confort d'affichage :
// la vraie protection reste dans le backend (Spring Security).
// Exemple : canActivate: [roleGuard('ADMINISTRATEUR')]
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const session = inject(AuthService).session();
    if (session && roles.includes(session.role)) {
      return true;
    }
    // Pas le bon rôle : retour à son espace
    return inject(Router).createUrlTree(['/espace']);
  };