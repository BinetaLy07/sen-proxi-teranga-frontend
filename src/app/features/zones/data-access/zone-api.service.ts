import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Zone } from './zone.models';

// Backend : ZoneController (lecture publique)
@Injectable({ providedIn: 'root' })
export class ZoneApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Toutes les zones : régions, communes et quartiers
  lister() {
    return this.http.get<Zone[]>(`${this.baseUrl}/zones`);
  }
}
