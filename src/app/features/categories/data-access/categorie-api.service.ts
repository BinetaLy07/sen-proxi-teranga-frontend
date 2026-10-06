import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Categorie, CategorieSaisie } from './categorie.models';

// Backend : CategorieController.
// Lecture publique (catégories actives) ; le reste est réservé à l'administrateur.
@Injectable({ providedIn: 'root' })
export class CategorieApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  // Les catégories actives (Plomberie, Électricité…) : pour tout le monde
  lister() {
    return this.http.get<Categorie[]>(this.baseUrl);
  }

  // ---------- Administrateur ----------

  // Toutes les catégories, même désactivées
  listerToutes() {
    return this.http.get<Categorie[]>(`${this.baseUrl}/toutes`);
  }

  creer(saisie: CategorieSaisie) {
    return this.http.post<Categorie>(this.baseUrl, saisie);
  }

  modifier(id: number, saisie: CategorieSaisie) {
    return this.http.put<Categorie>(`${this.baseUrl}/${id}`, saisie);
  }

  // Une catégorie désactivée n'est plus proposée aux clients ni aux pros
  activer(id: number) {
    return this.http.patch<Categorie>(`${this.baseUrl}/${id}/activer`, {});
  }

  desactiver(id: number) {
    return this.http.patch<Categorie>(`${this.baseUrl}/${id}/desactiver`, {});
  }
}
