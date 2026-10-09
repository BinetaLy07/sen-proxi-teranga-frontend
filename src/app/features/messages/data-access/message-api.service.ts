import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Conversation, Message, Vocal } from './message.models';

// Backend : MessageController. L'identité vient du badge : pas d'id dans l'adresse.
// Deux sortes de discussions :
// - la discussion d'une demande (/demandes/{id}/messages) : seuls son client et son pro y écrivent ;
// - les questions générales (/messages/...) : entre un client et un pro, sans demande.
// Deux sortes de messages : écrits (JSON) et vocaux (envoi d'un fichier son).
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

  envoyerVocalDansDemande(demandeId: number, vocal: Vocal) {
    return this.http.post<Message>(
      `${this.baseUrl}/demandes/${demandeId}/messages/audio`,
      this.formulaire(vocal),
    );
  }

  // ---------- Questions générales ----------

  // Ouvrir les questions générales avec quelqu'un : les messages reçus deviennent « lus »
  avec(interlocuteurId: number) {
    return this.http.get<Message[]>(`${this.baseUrl}/messages/avec/${interlocuteurId}`);
  }

  envoyer(destinataireId: number, contenu: string) {
    return this.http.post<Message>(`${this.baseUrl}/messages/${destinataireId}`, { contenu });
  }

  envoyerVocal(destinataireId: number, vocal: Vocal) {
    return this.http.post<Message>(
      `${this.baseUrl}/messages/${destinataireId}/audio`,
      this.formulaire(vocal),
    );
  }

  // ---------- Pour tout le monde ----------

  // Le son d'un vocal. Il est protégé (seuls les 2 participants l'écoutent), donc on le
  // télécharge avec HttpClient (l'intercepteur ajoute le badge) sous forme de "blob".
  vocal(messageId: number) {
    return this.http.get(`${this.baseUrl}/messages/${messageId}/audio`, { responseType: 'blob' });
  }

  // Supprimer MON message (pendant 24 h). Réponse : le message devenu « supprimé »
  supprimer(messageId: number) {
    return this.http.delete<Message>(`${this.baseUrl}/messages/${messageId}`);
  }

  // « Supprimer pour moi » : n'importe quel message de mes discussions disparaît
  // seulement de MON écran (l'autre et l'administrateur le voient toujours)
  masquerPourMoi(messageId: number) {
    return this.http.delete<void>(`${this.baseUrl}/messages/${messageId}/pour-moi`);
  }

  // Le backend répond {"nonLus": 3} : on garde juste le nombre
  nombreNonLus() {
    return this.http
      .get<{ nonLus: number }>(`${this.baseUrl}/messages/non-lus`)
      .pipe(map((reponse) => reponse.nonLus));
  }

  // Envoi d'un fichier : format "multipart/form-data", champs "fichier" et "duree"
  private formulaire(vocal: Vocal) {
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
    };
    const donnees = new FormData();
    donnees.append('fichier', vocal.fichier, 'vocal.' + (extensions[vocal.fichier.type] ?? 'webm'));
    donnees.append('duree', String(vocal.duree));
    return donnees;
  }
}
