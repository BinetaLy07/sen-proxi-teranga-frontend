import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { environment } from '../../../../../environments/environment';
import { ImageProtegee } from '../../../../shared/components/image-protegee/image-protegee';
import { Favori } from '../../data-access/favori.models';
import { FavoriApiService } from '../../data-access/favori-api.service';

// « Mes favoris » : les professionnels que le client a gardés (bouton ♥ du profil).
@Component({ imports: [DatePipe, RouterLink, ImageProtegee], templateUrl: './mes-favoris.html' })
export class MesFavoris {
  private readonly favoriApi = inject(FavoriApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly favoris = signal<Favori[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyId = signal<number | null>(null);

  constructor() {
    this.favoriApi
      .lister(this.clientId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.favoris.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  retirer(f: Favori) {
    if (this.busyId() !== null) return;
    this.busyId.set(f.professionnelId);
    this.error.set('');
    this.favoriApi
      .retirer(this.clientId, f.professionnelId)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        // Retiré dans le backend : on l'enlève aussi de la liste affichée
        next: () => this.favoris.update((liste) => liste.filter((x) => x.id !== f.id)),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // Le backend donne le nom du fichier (ou null) : l'image s'affiche par cette adresse
  photoUrl(f: Favori) {
    return f.photo ? `${environment.apiUrl}/professionnels/${f.professionnelId}/photo` : null;
  }

  initiales(nomComplet: string) {
    return nomComplet
      .split(' ')
      .filter((mot) => mot.length > 0)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  note(valeur: number) {
    return valeur.toFixed(1).replace('.', ',');
  }
}
