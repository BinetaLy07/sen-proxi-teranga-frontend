import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ServicePro } from '../../professionnels/data-access/professionnel.models';
import { ServiceSaisie } from './service.models';

// Backend : ServiceProfessionnelController
@Injectable({ providedIn: 'root' })
export class ServiceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Pour le pro lui-même : tous ses services, même désactivés
  lister(proId: number) {
    const params = new HttpParams().set('actifsSeulement', false);
    return this.http.get<ServicePro[]>(`${this.baseUrl}/professionnels/${proId}/services`, {
      params,
    });
  }

  creer(proId: number, service: ServiceSaisie) {
    return this.http.post<ServicePro>(`${this.baseUrl}/professionnels/${proId}/services`, service);
  }

  modifier(proId: number, serviceId: number, service: ServiceSaisie) {
    return this.http.put<ServicePro>(this.url(proId, serviceId), service);
  }

  activer(proId: number, serviceId: number) {
    return this.http.patch<ServicePro>(this.url(proId, serviceId) + '/activer', {});
  }

  desactiver(proId: number, serviceId: number) {
    return this.http.patch<ServicePro>(this.url(proId, serviceId) + '/desactiver', {});
  }

  // Refusé par le backend si le service a déjà été utilisé dans une demande : on le désactive alors
  supprimer(proId: number, serviceId: number) {
    return this.http.delete<void>(this.url(proId, serviceId));
  }

  private url(proId: number, serviceId: number) {
    return `${this.baseUrl}/professionnels/${proId}/services/${serviceId}`;
  }
}
