import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Avis } from '../../professionnels/data-access/professionnel.models';

// Backend : AvisController
@Injectable({ providedIn: 'root' })
export class AvisApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // L'avis d'une demande (404 s'il n'y en a pas encore)
  deDemande(demandeId: number) {
    return this.http.get<Avis>(`${this.baseUrl}/demandes/${demandeId}/avis`);
  }

  // Le client note le travail : une seule fois, note de 1 à 5
  donner(clientId: number, demandeId: number, note: number, commentaire: string | null) {
    return this.http.post<Avis>(`${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/avis`, {
      note,
      commentaire,
    });
  }

  // Le pro répond à l'avis : une seule fois
  repondre(proId: number, demandeId: number, reponse: string) {
    return this.http.patch<Avis>(
      `${this.baseUrl}/professionnels/${proId}/demandes/${demandeId}/avis/reponse`,
      { reponse },
    );
  }
}
