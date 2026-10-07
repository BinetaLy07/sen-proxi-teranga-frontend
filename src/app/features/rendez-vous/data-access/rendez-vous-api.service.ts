import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { RendezVous } from './rendez-vous.models';

// Backend : RendezVousController (client et professionnel)
// Le client propose la date ; l'autre accepte ou propose une autre date.
@Injectable({ providedIn: 'root' })
export class RendezVousApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Le rendez-vous actuel d'une demande (404 s'il n'y en a pas encore)
  actuel(demandeId: number) {
    return this.http.get<RendezVous>(`${this.baseUrl}/demandes/${demandeId}/rendez-vous`);
  }

  // Toutes les dates d'une demande, de la plus ancienne à la plus récente
  // (dates remplacées, reportées, acceptée) : sert à l'historique de la discussion
  historique(demandeId: number) {
    return this.http.get<RendezVous[]>(
      `${this.baseUrl}/demandes/${demandeId}/rendez-vous/historique`,
    );
  }

  // ---------- Client ----------

  // Proposer une date : la première, ou une autre à la place de celle du pro
  // dateHeure au format "2026-10-10T09:00:00"
  proposerParClient(clientId: number, demandeId: number, dateHeure: string) {
    return this.http.post<RendezVous>(this.urlClient(clientId, demandeId), { dateHeure });
  }

  // Accepter la date proposée par le professionnel
  accepterParClient(clientId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlClient(clientId, demandeId) + '/accepter', {});
  }

  reporterParClient(clientId: number, demandeId: number, motif: string) {
    return this.http.patch<RendezVous>(this.urlClient(clientId, demandeId) + '/reporter', {
      motif,
    });
  }

  // Le client confirme que les travaux sont bien faits
  confirmerFin(clientId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlClient(clientId, demandeId) + '/confirmer-fin', {});
  }

  // ---------- Professionnel ----------

  // Proposer une autre date (celle du client ne convient pas)
  proposerParPro(proId: number, demandeId: number, dateHeure: string) {
    return this.http.post<RendezVous>(this.urlPro(proId, demandeId), { dateHeure });
  }

  // Accepter la date proposée par le client
  accepterParPro(proId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlPro(proId, demandeId) + '/accepter', {});
  }

  reporterParPro(proId: number, demandeId: number, motif: string) {
    return this.http.patch<RendezVous>(this.urlPro(proId, demandeId) + '/reporter', { motif });
  }

  commencer(proId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlPro(proId, demandeId) + '/commencer', {});
  }

  terminer(proId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlPro(proId, demandeId) + '/terminer', {});
  }

  private urlClient(clientId: number, demandeId: number) {
    return `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/rendez-vous`;
  }

  private urlPro(proId: number, demandeId: number) {
    return `${this.baseUrl}/professionnels/${proId}/demandes/${demandeId}/rendez-vous`;
  }
}
