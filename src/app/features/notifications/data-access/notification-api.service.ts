import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NotificationRecue } from './notification.models';

// Backend : NotificationController. Chacun ne voit que les siennes (identité du badge).
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  lister() {
    return this.http.get<NotificationRecue[]>(this.baseUrl);
  }

  // Le backend répond {"nonLues": 2} : on garde juste le nombre
  nombreNonLues() {
    return this.http
      .get<{ nonLues: number }>(`${this.baseUrl}/non-lues`)
      .pipe(map((reponse) => reponse.nonLues));
  }

  marquerLue(id: number) {
    return this.http.patch<NotificationRecue>(`${this.baseUrl}/${id}/lue`, {});
  }

  toutLu() {
    return this.http.patch<{ marquees: number }>(`${this.baseUrl}/tout-lu`, {});
  }
}
