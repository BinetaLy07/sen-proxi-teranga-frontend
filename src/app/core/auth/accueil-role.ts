import { Role } from './auth.models';

// La page d'arrivée de chaque rôle, après la connexion ou un clic sur le logo :
// chacun arrive sur son tableau de bord.
export const ACCUEIL_ROLE: Record<Role, string> = {
  CLIENT: '/client',
  PROFESSIONNEL: '/pro',
  ADMINISTRATEUR: '/admin',
};
