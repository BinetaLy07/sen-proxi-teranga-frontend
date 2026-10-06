import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Conversation, Message } from './message.models';

// Backend : MessageController. L'identité vient du badge : pas d'id dans l'adresse.
// Règles du backend : seulement entre un client et un pro ; un pro n'écrit qu'à un client
// qui l'a déjà contacté (message ou demande).
@Injectable({ providedIn: 'root' })
export class MessageApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/messages`;

  conversations() {
    return this.http.get<Conversation[]>(`${this.baseUrl}/conversations`);
  }

  // Ouvrir la conversation : les messages reçus deviennent « lus »
  avec(interlocuteurId: number) {
    return this.http.get<Message[]>(`${this.baseUrl}/avec/${interlocuteurId}`);
  }

  envoyer(destinataireId: number, contenu: string) {
    return this.http.post<Message>(`${this.baseUrl}/${destinataireId}`, { contenu });
  }

  // Le backend répond {"nonLus": 3} : on garde juste le nombre
  nombreNonLus() {
    return this.http
      .get<{ nonLus: number }>(`${this.baseUrl}/non-lus`)
      .pipe(map((reponse) => reponse.nonLus));
  }
}
