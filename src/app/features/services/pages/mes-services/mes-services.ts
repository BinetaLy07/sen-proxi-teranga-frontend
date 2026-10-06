import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Categorie } from '../../../categories/data-access/categorie.models';
import { CategorieApiService } from '../../../categories/data-access/categorie-api.service';
import { ServicePro, TypeTarif } from '../../../professionnels/data-access/professionnel.models';
import { TYPES_TARIF } from '../../data-access/service.models';
import { ServiceApiService } from '../../data-access/service-api.service';

// « Mes services » : le pro liste, ajoute, modifie, active / désactive ses services.
// Un service déjà utilisé dans une demande ne peut pas être supprimé : on le désactive.
@Component({ imports: [ReactiveFormsModule], templateUrl: './mes-services.html' })
export class MesServices {
  private readonly api = inject(ServiceApiService);
  private readonly categorieApi = inject(CategorieApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly typesTarif = TYPES_TARIF;
  readonly services = signal<ServicePro[]>([]);
  readonly categories = signal<Categorie[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  // Le formulaire : null = fermé, 0 = nouveau service, sinon l'id du service modifié
  readonly edition = signal<number | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    categorieId: ['', Validators.required],
    typeTarif: ['SUR_DEVIS' as TypeTarif, Validators.required],
    montant: [null as number | null, Validators.min(1)],
    description: [''],
  });

  constructor() {
    this.categorieApi.lister().subscribe({ next: (c) => this.categories.set(c) });
    this.charger();
  }

  private charger() {
    this.loading.set(true);
    this.api
      .lister(this.proId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.services.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Formulaire =====

  nouveau() {
    this.form.reset();
    this.edition.set(0);
    this.effacerMessages();
  }

  modifier(s: ServicePro) {
    this.form.setValue({
      titre: s.titre,
      categorieId: String(s.categorieId),
      typeTarif: s.typeTarif,
      montant: s.montant,
      description: s.description ?? '',
    });
    this.edition.set(s.id);
    this.effacerMessages();
  }

  fermer() {
    this.edition.set(null);
  }

  // Le montant est obligatoire pour « prix fixe » et « à partir de », interdit pour « sur devis »
  montantRequis() {
    return this.form.controls.typeTarif.value !== 'SUR_DEVIS';
  }

  enregistrer() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || (this.montantRequis() && !v.montant)) {
      this.error.set('Vérifiez le formulaire : titre, catégorie et montant si le prix est fixé.');
      return;
    }
    const service = {
      titre: v.titre.trim(),
      categorieId: Number(v.categorieId),
      typeTarif: v.typeTarif,
      montant: this.montantRequis() ? v.montant : null,
      description: v.description.trim() || null,
    };
    const id = this.edition();
    const requete =
      id === 0 || id === null
        ? this.api.creer(this.proId, service)
        : this.api.modifier(this.proId, id, service);
    this.executer(requete, id ? 'Service modifié.' : 'Service ajouté.', true);
  }

  // ===== Actions sur un service =====

  basculer(s: ServicePro) {
    const requete = s.actif
      ? this.api.desactiver(this.proId, s.id)
      : this.api.activer(this.proId, s.id);
    this.executer(requete, s.actif ? 'Service désactivé.' : 'Service réactivé.');
  }

  supprimer(s: ServicePro) {
    this.executer(this.api.supprimer(this.proId, s.id), 'Service supprimé.');
  }

  private executer(requete: Observable<unknown>, succes: string, fermer = false) {
    if (this.busy()) return;
    this.busy.set(true);
    this.effacerMessages();
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.success.set(succes);
        if (fermer) this.edition.set(null);
        this.charger();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  private effacerMessages() {
    this.error.set('');
    this.success.set('');
  }

  tarif(s: ServicePro) {
    const montant = s.montant != null ? s.montant.toLocaleString('fr-FR') + ' F' : '';
    if (s.typeTarif === 'FIXE') return montant + ' (prix fixe)';
    if (s.typeTarif === 'A_PARTIR_DE') return 'À partir de ' + montant;
    return 'Sur devis';
  }
}
