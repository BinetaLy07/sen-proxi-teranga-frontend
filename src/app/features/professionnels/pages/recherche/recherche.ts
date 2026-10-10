import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Categorie } from '../../../categories/data-access/categorie.models';
import { CategorieApiService } from '../../../categories/data-access/categorie-api.service';
import {
  iconeDe,
  infosFamilleDe,
  regrouperParFamille,
} from '../../../categories/data-access/familles';
import { WOLOF } from '../../../../shared/utils/wolof';
import { Zone } from '../../../zones/data-access/zone.models';
import { ZoneApiService } from '../../../zones/data-access/zone-api.service';
import { ProfessionnelResume } from '../../data-access/professionnel.models';
import { ProfessionnelApiService } from '../../data-access/professionnel-api.service';

// « Trouver un pro » : deux écrans, choisis par l'adresse (le bouton « retour » marche) :
// 1. /recherche : les services rangés par famille, et « Voir tous les professionnels » ;
// 2. /recherche?categorieId=6 (ou ?tous=1, ?metier=…, ?zoneId=…) : la liste des pros.
// Le backend ne renvoie que des professionnels VALIDÉS et non suspendus.
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recherche.html',
})
export class Recherche {
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly categorieApi = inject(CategorieApiService);
  private readonly zoneApi = inject(ZoneApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly wolof = WOLOF;
  readonly iconeDe = iconeDe;
  readonly infosFamilleDe = infosFamilleDe;

  // Les catégories, rangées par famille (les tuiles de l'écran 1)
  readonly categories = signal<Categorie[]>([]);
  readonly familles = computed(() => regrouperParFamille(this.categories()));

  // Ce que dit l'adresse
  readonly modeListe = signal(false); // false : écran 1 (services) ; true : écran 2 (liste)
  private readonly categorieId = signal<number | null>(null);
  // La liste d'un service (?categorieId=…) : elle est déjà triée, pas de barre de recherche
  readonly listeDUnService = computed(() => this.categorieId() !== null);
  readonly metierCherche = signal('');
  // Le service choisi (titre et icône de l'écran 2), ou null
  readonly categorieChoisie = computed(
    () => this.categories().find((c) => c.id === this.categorieId()) ?? null,
  );

  // Le menu déroulant des quartiers
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
    // À chaque changement d'adresse (clic sur un service, « retour »…), on se met à jour
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      const metier = q.get('metier') ?? '';
      const zoneId = q.get('zoneId') ?? '';
      const categorieId = Number(q.get('categorieId')) || null;
      this.categorieId.set(categorieId);
      this.metierCherche.set(metier.trim());
      this.form.setValue({ metier, zoneId });
      this.modeListe.set(q.has('tous') || categorieId !== null || !!metier.trim() || !!zoneId);
      if (this.modeListe()) {
        this.chercher(categorieId, metier, zoneId);
      }
    });
  }

  // L'adresse d'une tuile : le service, en gardant le quartier choisi
  lienCategorie(c: Categorie): Params {
    const zoneId = this.form.getRawValue().zoneId;
    return zoneId ? { categorieId: c.id, zoneId } : { categorieId: c.id };
  }

  // Bouton « Rechercher » : on va à la liste, en gardant le service affiché
  lancerRecherche() {
    const v = this.form.getRawValue();
    const params: Params = {};
    if (this.categorieId()) params['categorieId'] = this.categorieId();
    if (v.metier.trim()) params['metier'] = v.metier.trim();
    if (v.zoneId) params['zoneId'] = v.zoneId;
    if (Object.keys(params).length === 0) params['tous'] = 1;
    void this.router.navigate(['/recherche'], { queryParams: params });
  }

  // « Effacer » : retour à l'écran des services
  effacerFiltres() {
    this.form.reset();
    void this.router.navigate(['/recherche']);
  }

  private chercher(categorieId: number | null, metier: string, zoneId: string) {
    this.loading.set(true);
    this.error.set('');
    this.professionnelApi
      .rechercher({
        metier: metier.trim() || null,
        categorieId,
        zoneId: zoneId ? Number(zoneId) : null,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.resultats.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
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
