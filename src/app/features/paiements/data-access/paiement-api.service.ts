import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ModePaiement, Paiement } from './paiement.models';

// Backend : PaiementController. Le paiement se fait directement entre le client et le pro :
// la plateforme l'enregistre et le suit.
@Injectable({ providedIn: 'root' })
export class PaiementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Le paiement d'une demande (404 s'il n'y en a pas encore)
  deDemande(demandeId: number) {
    return this.http.get<Paiement>(`${this.baseUrl}/demandes/${demandeId}/paiement`);
  }

  // ---------- Client ----------

  // Le montant n'est pas envoyé : le backend le prend dans le devis accepté
  declarer(
    clientId: number,
    demandeId: number,
    modePaiement: ModePaiement,
    reference: string | null,
  ) {
    return this.http.post<Paiement>(
      `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/paiement`,
      { modePaiement, reference },
    );
  }

  // ---------- Professionnel ----------

  confirmer(proId: number, demandeId: number) {
    return this.http.patch<Paiement>(
      `${this.baseUrl}/professionnels/${proId}/demandes/${demandeId}/paiement/confirmer`,
      {},
    );
  }

  contester(proId: number, demandeId: number, motif: string) {
    return this.http.patch<Paiement>(
      `${this.baseUrl}/professionnels/${proId}/demandes/${demandeId}/paiement/contester`,
      { motif },
    );
  }

  // Le pro a reçu l'argent en main propre : il l'enregistre lui-même
  enregistrerEspeces(proId: number, demandeId: number) {
    return this.http.post<Paiement>(
      `${this.baseUrl}/professionnels/${proId}/demandes/${demandeId}/paiement/especes`,
      {},
    );
  }

  // Tous les paiements reçus par le pro (pour repérer ceux à confirmer)
  listerPourPro(proId: number) {
    return this.http.get<Paiement[]>(`${this.baseUrl}/professionnels/${proId}/paiements`);
  }
}
