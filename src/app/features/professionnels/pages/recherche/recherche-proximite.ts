import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, of, catchError } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Carte } from '../../../../shared/geolocalisation/carte';
import {
  GeolocalisationService,
  PositionGps,
} from '../../../../shared/geolocalisation/geolocalisation.service';
import { PositionApiService, ProfessionnelProche } from '../../data-access/position-api.service';
import { FiltresRecherche } from '../../data-access/professionnel.models';

@Component({
  selector: 'app-recherche-proximite',
  imports: [Carte, ReactiveFormsModule, RouterLink],
  template: ` <section class="my-6 space-y-4 rounded-2xl border border-emerald-200 bg-white p-5">
    <h2 class="text-xl font-bold">Les professionnels près de vous</h2>
    <p class="text-gray-600">
      Utilisez votre GPS ou cliquez sur la carte pour choisir le point de départ. Votre position
      sert à cette recherche et n’est pas enregistrée dans votre compte.
    </p>
    <div class="flex flex-wrap items-end gap-3">
      <button
        type="button"
        class="primary-button"
        [disabled]="localisation()"
        (click)="localiser()"
      >
        {{ localisation() ? 'Localisation…' : 'Trouver près de moi' }}
      </button>
      <div>
        <label for="rayon-proximite">Rayon de recherche</label>
        <select id="rayon-proximite" [formControl]="rayon">
          <option [ngValue]="5">5 km</option>
          <option [ngValue]="10">10 km</option>
          <option [ngValue]="20">20 km</option>
          <option [ngValue]="50">50 km</option>
        </select>
      </div>
      @if (position()) {
        <button type="button" class="secondary-button" (click)="effacer()">
          Effacer ma position
        </button>
      }
    </div>
    @if (erreur()) {
      <p class="notice error" role="alert">{{ erreur() }}</p>
    }
    <app-carte
      [position]="position()"
      [points]="points()"
      (selection)="choisir($event)"
      (ouvrir)="ouvrir($event)"
    />
    <p class="text-sm text-gray-500">
      Point bleu : votre départ. Points verts : lieux d’activité des professionnels. Distances à vol
      d’oiseau. Seuls les professionnels vérifiés ayant renseigné une position apparaissent.
    </p>
    @if (loading()) {
      <p role="status">Recherche des professionnels à proximité…</p>
    }
    @if (position() && !loading() && !erreur()) {
      <p role="status" class="font-semibold">
        {{ resultats().length }} professionnel(s) dans un rayon de {{ rayon.value }} km
      </p>
      @if (!resultats().length) {
        <p>
          Aucun professionnel géolocalisé ne correspond. Élargissez le rayon ou changez les filtres.
        </p>
      }
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (pro of resultats(); track pro.professionnel.id) {
          <a
            class="rounded-xl border border-gray-200 p-4 hover:border-emerald-600"
            [routerLink]="['/professionnels', pro.professionnel.id]"
          >
            <strong class="block">{{ pro.professionnel.nomComplet }}</strong>
            <span class="block">{{ pro.professionnel.metier }}</span>
            <span class="text-emerald-700"
              >À {{ distance(pro.distanceKm) }} km · Voir le profil →</span
            >
          </a>
        }
      </div>
    }
  </section>`,
})
export class RechercheProximite {
  readonly metier = input('');
  readonly categorieId = input<number | null>(null);
  readonly zoneId = input('');
  private readonly api = inject(PositionApiService);
  private readonly gps = inject(GeolocalisationService);
  private readonly router = inject(Router);
  private readonly requetes = new Subject<{
    position: PositionGps;
    filtres: FiltresRecherche;
    rayon: number;
  } | null>();
  readonly position = signal<PositionGps | null>(null);
  readonly resultats = signal<ProfessionnelProche[]>([]);
  readonly loading = signal(false);
  readonly localisation = signal(false);
  readonly erreur = signal('');
  readonly rayon = new FormControl(10, { nonNullable: true });
  private readonly rayonSelectionne = signal(10);
  readonly points = computed(() =>
    this.resultats().map((pro) => ({
      latitude: pro.latitude,
      longitude: pro.longitude,
      id: pro.professionnel.id,
      titre: pro.professionnel.nomComplet,
    })),
  );

  constructor() {
    this.rayon.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.rayonSelectionne.set(v));
    this.requetes
      .pipe(
        switchMap((q) =>
          q
            ? this.api.rechercher(q.position, q.rayon, q.filtres).pipe(
                catchError((e) => {
                  this.erreur.set(apiError(e));
                  return of([] as ProfessionnelProche[]);
                }),
              )
            : of([] as ProfessionnelProche[]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((liste) => {
        this.resultats.set(liste);
        this.loading.set(false);
      });
    effect(() => {
      const position = this.position();
      const filtres = {
        metier: this.metier().trim() || null,
        categorieId: this.categorieId(),
        zoneId: Number(this.zoneId()) || null,
      };
      const rayon = this.rayonSelectionne();
      this.erreur.set('');
      this.resultats.set([]);
      this.loading.set(position !== null);
      this.requetes.next(position ? { position, filtres, rayon } : null);
    });
  }

  choisir(p: PositionGps) {
    this.position.set(p);
  }
  effacer() {
    this.position.set(null);
  }
  ouvrir(id: number) {
    void this.router.navigate(['/professionnels', id]);
  }
  distance(km: number) {
    return km.toFixed(1).replace('.', ',');
  }

  async localiser() {
    this.localisation.set(true);
    this.erreur.set('');
    try {
      this.position.set(await this.gps.localiser());
    } catch (e) {
      this.erreur.set((e as Error).message);
    } finally {
      this.localisation.set(false);
    }
  }
}
