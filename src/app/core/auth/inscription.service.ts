import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { UserResponse } from './auth.models';

// Ce qu'on envoie pour inscrire un client (backend : InscriptionClientRequest)
export interface InscriptionClient {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  motDePasse: string;
  cguAcceptees: boolean;
  adresse: string; // obligatoire
  quartier: string; // obligatoire : écrit par le client (ex : "Sacré-Cœur 3")
}

// Ce qu'on envoie pour inscrire un professionnel (backend : InscriptionProfessionnelRequest)
export interface InscriptionProfessionnel {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  motDePasse: string;
  cguAcceptees: boolean;
  metier: string; // obligatoire
  competences: string | null;
  description: string; // obligatoire
  whatsapp: string | null; // facultatif (souvent le même numéro que le téléphone)
  zones: string; // obligatoire : écrites par le pro, ex : "Médina, Fass, Grand Yoff"
}

// Backend : AuthController (adresses publiques, pas besoin d'être connecté).
// Un formulaire par rôle : chacun envoie seulement les informations qui le concernent.
@Injectable({ providedIn: 'root' })
export class InscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth/inscription`;

  inscrireClient(inscription: InscriptionClient) {
    return this.http.post<UserResponse>(`${this.baseUrl}/client`, inscription);
  }

  // Le compte est créé « en attente de vérification » : l'admin le validera
  inscrireProfessionnel(inscription: InscriptionProfessionnel) {
    return this.http.post<UserResponse>(`${this.baseUrl}/professionnel`, inscription);
  }
}
