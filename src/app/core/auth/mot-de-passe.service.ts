import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Pour ces 3 actions, le backend répond juste un message à afficher
export interface MessageResponse {
  message: string;
}

// Tout ce qui concerne le mot de passe (backend : MotDePasseController)
@Injectable({ providedIn: 'root' })
export class MotDePasseService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth/mot-de-passe`;

  // Mot de passe oublié, étape 1 : recevoir un code par SMS (page publique)
  demanderCode(telephone: string) {
    return this.http.post<MessageResponse>(`${this.url}/oublie`, { telephone });
  }

  // Mot de passe oublié, étape 2 : le code reçu + le nouveau mot de passe (page publique)
  reinitialiser(telephone: string, code: string, nouveauMotDePasse: string) {
    return this.http.post<MessageResponse>(`${this.url}/reinitialiser`, {
      telephone,
      code,
      nouveauMotDePasse,
    });
  }

  // Changer mon mot de passe quand je suis connecté (l'intercepteur ajoute le badge)
  changer(ancienMotDePasse: string, nouveauMotDePasse: string) {
    return this.http.patch<MessageResponse>(this.url, { ancienMotDePasse, nouveauMotDePasse });
  }
}