import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Categorie } from './categorie.models';

// Backend : CategorieController (lecture publique)
@Injectable({ providedIn: 'root' })
export class CategorieApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Les catégories actives (Plomberie, Électricité…)
  lister() {
    return this.http.get<Categorie[]>(`${this.baseUrl}/categories`);
  }
}
