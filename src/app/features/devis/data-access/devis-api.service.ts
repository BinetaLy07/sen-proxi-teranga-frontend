import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Devis } from './devis.models';

// Backend : DevisController (côté client)
@Injectable({ providedIn: 'root' })
export class DevisApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Le devis actuel d'une demande (la dernière version)
  actuel(demandeId: number) {
    return this.http.get<Devis>(`${this.baseUrl}/demandes/${demandeId}/devis`);
  }

  accepter(clientId: number, demandeId: number) {
    return this.http.patch<Devis>(
      `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/devis/accepter`,
      {},
    );
  }

  // Refuser : la demande est annulée (motif obligatoire)
  refuser(clientId: number, demandeId: number, motif: string) {
    return this.http.patch<Devis>(
      `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/devis/refuser`,
      { motif },
    );
  }

  // Négocier la main-d'œuvre : 2 fois maximum (motif obligatoire)
  demanderRevision(clientId: number, demandeId: number, motif: string) {
    return this.http.patch<Devis>(
      `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/devis/demander-revision`,
      { motif },
    );
  }
}
