import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CreerDemande, Demande, Media } from './demande.models';

// Backend : DemandeController et MediaController (côté client)
@Injectable({ providedIn: 'root' })
export class DemandeApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Mes demandes (les plus récentes d'abord)
  listerPourClient(clientId: number) {
    return this.http.get<Demande[]>(`${this.baseUrl}/clients/${clientId}/demandes`);
  }

  creer(clientId: number, demande: CreerDemande) {
    return this.http.post<Demande>(`${this.baseUrl}/clients/${clientId}/demandes`, demande);
  }

  // Photos / vidéos : un FormData, chaque fichier sous le nom "fichiers".
  // On ne met pas de Content-Type : le navigateur ajoute lui-même la frontière multipart.
  ajouterMedias(clientId: number, demandeId: number, fichiers: File[]) {
    const formData = new FormData();
    for (const fichier of fichiers) {
      formData.append('fichiers', fichier);
    }
    return this.http.post<Media[]>(
      `${this.baseUrl}/clients/${clientId}/demandes/${demandeId}/medias`,
      formData,
    );
  }
}
