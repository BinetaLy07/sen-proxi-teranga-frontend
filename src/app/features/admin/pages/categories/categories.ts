import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Categorie, FamilleCategorie } from '../../../categories/data-access/categorie.models';
import { FAMILLES, iconeDe, infosFamilleDe } from '../../../categories/data-access/familles';
import { CategorieApiService } from '../../../categories/data-access/categorie-api.service';

// « Catégories de métiers » : l'administrateur gère la liste des catégories
// (Plomberie, Électricité…) que les pros choisissent pour leurs services
// et que les clients utilisent pour filtrer la recherche.
@Component({ imports: [ReactiveFormsModule], templateUrl: './categories.html' })
export class Categories {
  private readonly api = inject(CategorieApiService);

  readonly categories = signal<Categorie[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly iconeDe = iconeDe;
  readonly infosFamilleDe = infosFamilleDe;
  // Le menu déroulant « Famille »
  readonly familles = Object.entries(FAMILLES).map(([cle, f]) => ({
    cle: cle as FamilleCategorie,
    libelle: `${f.icone} ${f.libelle}`,
  }));

  // Les actives d'abord, puis par ordre alphabétique
  readonly triees = computed(() =>
    [...this.categories()].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.nom.localeCompare(b.nom, 'fr'),
    ),
  );
  readonly nombreActives = computed(() => this.categories().filter((c) => c.active).length);

  // Le formulaire sert à ajouter OU à modifier (enModification = l'id modifié)
  readonly enModification = signal<number | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    icone: ['', Validators.maxLength(16)],
    famille: ['' as FamilleCategorie | ''],
  });

  constructor() {
    this.api
      .listerToutes()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.categories.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  modifier(c: Categorie) {
    this.enModification.set(c.id);
    this.form.setValue({
      nom: c.nom,
      description: c.description ?? '',
      icone: c.icone ?? '',
      famille: c.famille ?? '',
    });
    this.message.set('');
    this.error.set('');
  }

  annuler() {
    this.enModification.set(null);
    this.form.reset();
  }

  enregistrer() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const saisie = {
      nom: v.nom.trim(),
      description: v.description.trim() || null,
      icone: v.icone.trim() || null,
      famille: v.famille || null,
    };
    const id = this.enModification();
    this.executer(
      id === null ? this.api.creer(saisie) : this.api.modifier(id, saisie),
      id === null ? `Catégorie « ${saisie.nom} » ajoutée.` : 'Catégorie modifiée.',
    );
  }

  basculer(c: Categorie) {
    this.executer(
      c.active ? this.api.desactiver(c.id) : this.api.activer(c.id),
      c.active ? `« ${c.nom} » est désactivée.` : `« ${c.nom} » est de nouveau active.`,
    );
  }

  // Le backend renvoie la catégorie à jour : on l'ajoute ou on la remplace dans la liste
  private executer(requete: Observable<Categorie>, succes: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (categorie) => {
        this.categories.update((liste) =>
          liste.some((c) => c.id === categorie.id)
            ? liste.map((c) => (c.id === categorie.id ? categorie : c))
            : [...liste, categorie],
        );
        this.message.set(succes);
        this.annuler();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  invalid(nom: 'nom' | 'description' | 'icone') {
    const c = this.form.controls[nom];
    return c.touched && c.invalid;
  }
}
