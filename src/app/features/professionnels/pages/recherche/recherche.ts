import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Categorie } from '../../../categories/data-access/categorie.models';
import { CategorieApiService } from '../../../categories/data-access/categorie-api.service';
import { Zone } from '../../../zones/data-access/zone.models';
import { ZoneApiService } from '../../../zones/data-access/zone-api.service';
import { ProfessionnelResume } from '../../data-access/professionnel.models';
import { ProfessionnelApiService } from '../../data-access/professionnel-api.service';

// « Trouver un pro » : filtres (métier, catégorie, quartier) + cartes des résultats.
// Le backend ne renvoie que des professionnels VALIDÉS et non suspendus.
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recherche.html',
})
export class Recherche {
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly categorieApi = inject(CategorieApiService);
  private readonly zoneApi = inject(ZoneApiService);

  // Les listes des menus déroulants
  readonly categories = signal<Categorie[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly communes = computed(() => this.zones().filter((z) => z.type === 'COMMUNE'));
  readonly quartiers = computed(() => this.zones().filter((z) => z.type === 'QUARTIER'));

  // Les résultats et les 3 états : chargement, résultat, erreur
  readonly resultats = signal<ProfessionnelResume[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  // Les valeurs des <select> sont du texte : '' veut dire « tous »
  readonly form = inject(FormBuilder).nonNullable.group({
    metier: [''],
    categorieId: [''],
    zoneId: [''],
  });

  constructor() {
    this.categorieApi.lister().subscribe({
      next: (liste) => this.categories.set(liste),
      error: () => this.categories.set([]),
    });
    this.zoneApi.lister().subscribe({
      next: (liste) => this.zones.set(liste),
      error: () => this.zones.set([]),
    });
    // Filtres reçus dans l'adresse (depuis l'accueil) : /recherche?metier=plombier&zoneId=3
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    this.form.patchValue({
      metier: q.get('metier') ?? '',
      categorieId: q.get('categorieId') ?? '',
      zoneId: q.get('zoneId') ?? '',
    });
    // Au départ : tous les professionnels (ou ceux des filtres reçus)
    this.rechercher();
  }

  rechercher() {
    if (this.loading()) return;
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.professionnelApi
      .rechercher({
        metier: v.metier.trim() || null,
        categorieId: v.categorieId ? Number(v.categorieId) : null,
        zoneId: v.zoneId ? Number(v.zoneId) : null,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.resultats.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  effacerFiltres() {
    this.form.reset();
    this.rechercher();
  }

  // "Moussa Ndiaye" -> "MN" (quand le pro n'a pas de photo)
  initiales(nomComplet: string) {
    return nomComplet
      .split(' ')
      .filter((mot) => mot.length > 0)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  // 4.8 -> "4,8" (écriture française)
  note(valeur: number) {
    return valeur.toFixed(1).replace('.', ',');
  }
}
