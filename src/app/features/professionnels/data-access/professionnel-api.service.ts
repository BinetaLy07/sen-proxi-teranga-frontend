import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  FiltresRecherche,
  ModifierProfil,
  ProfessionnelResume,
  ProfilProfessionnel,
  Realisation,
} from './professionnel.models';

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

  // Son propre profil, même s'il n'est pas encore validé (espace du pro)
  monProfil(professionnelId: number) {
    return this.http.get<ProfilProfessionnel>(
      `${this.baseUrl}/professionnels/${professionnelId}/mon-profil`,
    );
  }

  // ---------- Espace du professionnel ----------

  modifierProfil(professionnelId: number, profil: ModifierProfil) {
    return this.http.put<ProfilProfessionnel>(
      `${this.baseUrl}/professionnels/${professionnelId}/profil`,
      profil,
    );
  }

  // Fichier envoyé en "multipart" sous le nom "photo" (JPG ou PNG)
  changerPhoto(professionnelId: number, photo: File) {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.post<ProfilProfessionnel>(
      `${this.baseUrl}/professionnels/${professionnelId}/photo`,
      formData,
    );
  }

  ajouterRealisation(professionnelId: number, photo: File, titre: string, description: string) {
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('titre', titre);
    if (description) formData.append('description', description);
    return this.http.post<Realisation>(
      `${this.baseUrl}/professionnels/${professionnelId}/realisations`,
      formData,
    );
  }

  supprimerRealisation(professionnelId: number, realisationId: number) {
    return this.http.delete<void>(
      `${this.baseUrl}/professionnels/${professionnelId}/realisations/${realisationId}`,
    );
  }
}
