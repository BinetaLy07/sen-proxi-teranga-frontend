import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Conversation, Message } from './message.models';

// Backend : MessageController. L'identité vient du badge : pas d'id dans l'adresse.
// Deux sortes de discussions :
// - la discussion d'une demande (/demandes/{id}/messages) : seuls son client et son pro y écrivent ;
// - les questions générales (/messages/...) : entre un client et un pro, sans demande.
@Injectable({ providedIn: 'root' })
export class MessageApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  conversations() {
    return this.http.get<Conversation[]>(`${this.baseUrl}/messages/conversations`);
  }

  // ---------- Discussion d'une demande ----------

  // Ouvrir la discussion : les messages reçus deviennent « lus »
  deLaDemande(demandeId: number) {
    return this.http.get<Message[]>(`${this.baseUrl}/demandes/${demandeId}/messages`);
  }

  // Le message part automatiquement vers « l'autre » (le pro ou le client de la demande)
  envoyerDansDemande(demandeId: number, contenu: string) {
    return this.http.post<Message>(`${this.baseUrl}/demandes/${demandeId}/messages`, { contenu });
  }

  // ---------- Questions générales ----------

  // Ouvrir les questions générales avec quelqu'un : les messages reçus deviennent « lus »
  avec(interlocuteurId: number) {
    return this.http.get<Message[]>(`${this.baseUrl}/messages/avec/${interlocuteurId}`);
  }

  envoyer(destinataireId: number, contenu: string) {
    return this.http.post<Message>(`${this.baseUrl}/messages/${destinataireId}`, { contenu });
  }

  // Le backend répond {"nonLus": 3} : on garde juste le nombre
  nombreNonLus() {
    return this.http
      .get<{ nonLus: number }>(`${this.baseUrl}/messages/non-lus`)
      .pipe(map((reponse) => reponse.nonLus));
  }
}
