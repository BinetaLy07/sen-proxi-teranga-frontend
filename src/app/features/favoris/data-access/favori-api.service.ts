import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Favori } from './favori.models';

// Backend : FavoriController
@Injectable({ providedIn: 'root' })
export class FavoriApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  lister(clientId: number) {
    return this.http.get<Favori[]>(`${this.baseUrl}/clients/${clientId}/favoris`);
  }

  ajouter(clientId: number, professionnelId: number) {
    return this.http.post<Favori>(
      `${this.baseUrl}/clients/${clientId}/favoris/${professionnelId}`,
      {},
    );
  }

  retirer(clientId: number, professionnelId: number) {
    return this.http.delete<void>(`${this.baseUrl}/clients/${clientId}/favoris/${professionnelId}`);
  }
}
