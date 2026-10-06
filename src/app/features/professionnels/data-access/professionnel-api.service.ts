import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FiltresRecherche, ProfessionnelResume, ProfilProfessionnel } from './professionnel.models';

// Backend : ProfessionnelController (recherche et profil : publics)
@Injectable({ providedIn: 'root' })
export class ProfessionnelApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // GET /api/professionnels/recherche?metier=…&categorieId=…&zoneId=…
  // On n'envoie que les filtres remplis.
  rechercher(filtres: FiltresRecherche) {
    let params = new HttpParams();
    if (filtres.metier) params = params.set('metier', filtres.metier);
    if (filtres.categorieId) params = params.set('categorieId', filtres.categorieId);
    if (filtres.zoneId) params = params.set('zoneId', filtres.zoneId);
    return this.http.get<ProfessionnelResume[]>(`${this.baseUrl}/professionnels/recherche`, {
      params,
    });
  }

  // Le profil public d'un professionnel validé
  profil(professionnelId: number) {
    return this.http.get<ProfilProfessionnel>(
      `${this.baseUrl}/professionnels/${professionnelId}/profil`,
    );
  }
}
