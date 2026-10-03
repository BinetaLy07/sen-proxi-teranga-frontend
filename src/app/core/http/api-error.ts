import { HttpErrorResponse } from '@angular/common/http';
export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur est survenue. Réessayez.';
  if (error.status === 0)
    return 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';
  if (error.status === 401) return 'Email ou mot de passe incorrect, ou compte suspendu.';
  if (error.status === 403) return 'Vous ne disposez pas des droits nécessaires.';
  return typeof error.error?.message === 'string'
    ? error.error.message
    : 'Le serveur ne peut pas traiter votre demande pour le moment.';
}
