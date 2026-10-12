import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Carte } from '../../../../shared/geolocalisation/carte';
import {
  GeolocalisationService,
  PositionGps,
} from '../../../../shared/geolocalisation/geolocalisation.service';
import { PositionApiService } from '../../data-access/position-api.service';

@Component({
  selector: 'app-position-professionnel',
  imports: [Carte],
  template: ` <section class="my-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
    <h2 class="text-xl font-bold">Votre lieu d’activité</h2>
    <p class="text-gray-600">
      Cette position sera visible des clients sur la carte. Utilisez votre GPS sur votre lieu de
      travail ou cliquez sur la carte pour le choisir.
    </p>
    @if (erreur()) {
      <p class="notice error" role="alert">{{ erreur() }}</p>
    }
    @if (message()) {
      <p class="notice success" role="status">{{ message() }}</p>
    }
    <button
      type="button"
      class="primary-button"
      [disabled]="busy() || chargement()"
      (click)="localiser()"
    >
      {{ localisation() ? 'Localisation…' : 'Utiliser ma position GPS' }}
    </button>
    <app-carte [position]="position()" (selection)="choisir($event)" />
    @if (position(); as p) {
      <p class="text-sm text-gray-600">
        Latitude : {{ p.latitude.toFixed(6) }} · Longitude : {{ p.longitude.toFixed(6) }}
      </p>
    }
    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="primary-button"
        [disabled]="!position() || busy() || chargement()"
        (click)="enregistrer()"
      >
        Enregistrer le lieu d’activité
      </button>
      <button
        type="button"
        class="secondary-button"
        [disabled]="busy() || chargement() || !enregistree()"
        (click)="supprimer()"
      >
        Retirer ma position publique
      </button>
    </div>
  </section>`,
})
export class PositionProfessionnel {
  private readonly api = inject(PositionApiService);
  private readonly gps = inject(GeolocalisationService);
  private readonly id = inject(AuthService).session()!.utilisateurId;
  readonly position = signal<PositionGps | null>(null);
  readonly erreur = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly chargement = signal(true);
  readonly localisation = signal(false);
  readonly enregistree = signal(false);

  constructor() {
    this.api
      .consulter(this.id)
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe({
        next: (p) => {
          if (p.latitude !== null && p.longitude !== null) {
            this.position.set({ latitude: p.latitude, longitude: p.longitude });
            this.enregistree.set(true);
          }
        },
        error: (e) => this.erreur.set(apiError(e)),
      });
  }

  choisir(p: PositionGps) {
    if (this.busy() || this.chargement()) return;
    this.position.set(p);
    this.message.set('Position choisie. Enregistrez-la pour la rendre visible aux clients.');
  }

  async localiser() {
    this.localisation.set(true);
    this.busy.set(true);
    this.erreur.set('');
    try {
      const p = await this.gps.localiser();
      this.position.set(p);
      this.message.set(
        'Position GPS récupérée. Vérifiez le point puis enregistrez votre lieu d’activité.',
      );
    } catch (e) {
      this.erreur.set((e as Error).message);
    } finally {
      this.localisation.set(false);
      this.busy.set(false);
    }
  }

  enregistrer() {
    const p = this.position();
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.erreur.set('');
    this.api
      .enregistrer(this.id, p)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.enregistree.set(true);
          this.message.set('Votre lieu d’activité est enregistré.');
        },
        error: (e) => this.erreur.set(apiError(e)),
      });
  }

  supprimer() {
    this.busy.set(true);
    this.erreur.set('');
    this.api
      .supprimer(this.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.position.set(null);
          this.enregistree.set(false);
          this.message.set('Votre position publique a été retirée.');
        },
        error: (e) => this.erreur.set(apiError(e)),
      });
  }
}
