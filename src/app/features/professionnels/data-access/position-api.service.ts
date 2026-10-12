import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PositionGps } from '../../../shared/geolocalisation/geolocalisation.service';
import { FiltresRecherche, ProfessionnelResume } from './professionnel.models';

export interface ProfessionnelProche extends PositionGps {
  professionnel: ProfessionnelResume;
  distanceKm: number;
}

@Injectable({ providedIn: 'root' })
export class PositionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  consulter(id: number) {
    return this.http.get<{ latitude: number | null; longitude: number | null }>(
      `${this.base}/professionnels/${id}/position`,
    );
  }

  enregistrer(id: number, position: PositionGps) {
    return this.http.put<PositionGps>(`${this.base}/professionnels/${id}/position`, position);
  }

  supprimer(id: number) {
    return this.http.delete<void>(`${this.base}/professionnels/${id}/position`);
  }

  rechercher(position: PositionGps, rayonKm: number, filtres: FiltresRecherche) {
    let params = new HttpParams()
      .set('latitude', position.latitude)
      .set('longitude', position.longitude)
      .set('rayonKm', rayonKm);
    if (filtres.metier) params = params.set('metier', filtres.metier);
    if (filtres.categorieId) params = params.set('categorieId', filtres.categorieId);
    if (filtres.zoneId) params = params.set('zoneId', filtres.zoneId);
    return this.http.get<ProfessionnelProche[]>(`${this.base}/proximite/professionnels`, {
      params,
    });
  }
}
