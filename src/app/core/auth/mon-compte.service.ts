import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Role } from './auth.models';

// Ce que le backend renvoie pour GET /api/auth/moi (jamais le mot de passe)
export interface MonCompte {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  role: Role;
  statutCompte: 'ACTIF' | 'SUSPENDU';
  // Seulement pour un professionnel (null sinon)
  statutVerification: 'EN_ATTENTE' | 'VALIDE' | 'CORRECTION_DEMANDEE' | 'REFUSE' | null;
  motifVerification: string | null;
  // Seulement pour un professionnel (pour pré-remplir son profil)
  whatsapp: string | null;
  alerteSmsActive: boolean | null;
  adresse: string | null;
  zoneId: number | null;
  zoneNom: string | null;
  dateInscription: string;
}

// Ce qu'on envoie pour PUT /api/auth/moi (l'email ne change pas : il sert à se connecter)
export interface ModifierMonCompte {
  prenom: string;
  nom: string;
  telephone: string;
  adresse: string | null;
  zoneId: number | null;
}

// « Mon compte » (backend : MonCompteController). L'intercepteur ajoute le badge.
@Injectable({ providedIn: 'root' })
export class MonCompteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth/moi`;

  consulter() {
    return this.http.get<MonCompte>(this.url);
  }

  modifier(modification: ModifierMonCompte) {
    return this.http.put<MonCompte>(this.url, modification);
  }
}
