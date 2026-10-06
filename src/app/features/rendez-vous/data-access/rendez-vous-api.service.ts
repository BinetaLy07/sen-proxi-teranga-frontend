import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { RendezVous } from './rendez-vous.models';

// Backend : RendezVousController (client et professionnel)
@Injectable({ providedIn: 'root' })
export class RendezVousApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Le rendez-vous actuel d'une demande (404 s'il n'y en a pas encore)
  actuel(demandeId: number) {
    return this.http.get<RendezVous>(`${this.baseUrl}/demandes/${demandeId}/rendez-vous`);
  }

  // ---------- Client ----------

  accepter(clientId: number, demandeId: number) {
    return this.http.patch<RendezVous>(this.urlClient(clientId, demandeId) + '/accepter', {});
  }

  refuser(clientId: number, demandeId: number, motif: string) {
    return this.http.patch<RendezVous>(this.urlClient(clientId, demandeId) + '/refuser', { motif });
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

  // dateHeure au format "2026-10-10T09:00:00"
  proposer(proId: number, demandeId: number, dateHeure: string) {
    return this.http.post<RendezVous>(this.urlPro(proId, demandeId), { dateHeure });
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
