import { Injectable, signal } from '@angular/core';
import { Role } from '../../../core/auth/auth.models';

// Ce que la fenêtre de bienvenue doit afficher (null : pas de fenêtre)
export interface Bienvenue {
  prenom: string;
  nom: string;
  role: Role;
}

// Fait le lien entre la page de connexion (qui sait que c'est la 1re connexion)
// et la fenêtre de bienvenue (affichée par-dessus le tableau de bord).
@Injectable({ providedIn: 'root' })
export class BienvenueService {
  readonly aAfficher = signal<Bienvenue | null>(null);

  afficher(prenom: string, nom: string, role: Role) {
    this.aAfficher.set({ prenom, nom, role });
  }

  fermer() {
    this.aAfficher.set(null);
  }
}
