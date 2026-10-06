import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Devis, TypeLigneDevis } from '../../../devis/data-access/devis.models';
import { DevisApiService } from '../../../devis/data-access/devis-api.service';
import { Demande, StatutDemande } from '../../data-access/demande.models';

const STATUTS_VISIBLES: StatutDemande[] = [
  'ACCEPTEE',
  'DEVIS_ENVOYE',
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
  'CONFIRMEE',
  'CLOTUREE',
  'EN_LITIGE',
];

// Bloc « Devis » côté professionnel : créer le devis (lignes), le réviser si le client
// le demande, et voir sa réponse. Le total officiel est calculé par le serveur.
@Component({
  selector: 'app-devis-pro',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './devis-pro.html',
})
export class DevisPro {
  private readonly api = inject(DevisApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly devis = signal<Devis | null>(null);
  readonly charge = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  // On peut saisir un devis : demande acceptée sans devis, ou révision demandée par le client
  readonly peutSaisir = computed(
    () =>
      (this.demande().statut === 'ACCEPTEE' && !this.devis()) ||
      this.devis()?.statut === 'REVISION_DEMANDEE',
  );

  // Les lignes du devis : un tableau de petits formulaires (FormArray)
  readonly lignes = this.fb.array([this.nouvelleLigne('MAIN_OEUVRE', 'Main-d’œuvre')]);

  constructor() {
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.devis.set(null);
    this.charge.set(false);
    this.error.set('');
    if (!this.visible()) return;
    this.api.actuel(demandeId).subscribe({
      next: (devis) => {
        this.devis.set(devis);
        this.charge.set(true);
        // Révision : on repart des lignes actuelles, le pro n'a qu'à changer les prix
        if (devis.statut === 'REVISION_DEMANDEE') {
          this.lignes.clear();
          for (const l of devis.lignes) {
            this.lignes.push(this.nouvelleLigne(l.type, l.libelle, l.quantite, l.prixUnitaire));
          }
        }
      },
      error: () => {
        // 404 : pas encore de devis -> formulaire vide avec la main-d'œuvre
        this.charge.set(true);
        this.lignes.clear();
        this.lignes.push(this.nouvelleLigne('MAIN_OEUVRE', 'Main-d’œuvre'));
      },
    });
  }

  nouvelleLigne(type: TypeLigneDevis, libelle = '', quantite = 1, prix: number | null = null) {
    return this.fb.group({
      type: [type],
      libelle: [libelle, [Validators.required, Validators.maxLength(150)]],
      quantite: [quantite, [Validators.required, Validators.min(1)]],
      prixUnitaire: [prix as number | null, [Validators.required, Validators.min(1)]],
    });
  }

  ajouterMateriel() {
    this.lignes.push(this.nouvelleLigne('MATERIEL'));
  }

  // Une seule ligne de déplacement au maximum (règle du backend)
  aDeplacement() {
    return this.lignes.getRawValue().some((l) => l.type === 'DEPLACEMENT');
  }

  ajouterDeplacement() {
    if (!this.aDeplacement()) this.lignes.push(this.nouvelleLigne('DEPLACEMENT', 'Déplacement'));
  }

  supprimer(index: number) {
    this.lignes.removeAt(index);
  }

  // Total indicatif (le serveur recalcule le vrai total)
  total() {
    return this.lignes
      .getRawValue()
      .reduce((somme, l) => somme + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0);
  }

  typeLigne(type: TypeLigneDevis) {
    return type === 'MAIN_OEUVRE'
      ? 'Main-d’œuvre'
      : type === 'MATERIEL'
        ? 'Matériel'
        : 'Déplacement';
  }

  montant(valeur: number | null) {
    return valeur == null ? '' : valeur.toLocaleString('fr-FR') + ' F';
  }

  envoyer() {
    if (this.busy()) return;
    this.lignes.markAllAsTouched();
    if (this.lignes.invalid) return;
    const lignes = this.lignes.getRawValue().map((l) => ({
      type: l.type,
      libelle: l.libelle.trim(),
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
    }));
    const revision = this.devis()?.statut === 'REVISION_DEMANDEE';
    const requete = revision
      ? this.api.reviser(this.proId, this.demande().id, lignes)
      : this.api.envoyer(this.proId, this.demande().id, lignes);
    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () =>
        this.actualise.emit(revision ? 'Nouveau devis envoyé.' : 'Devis envoyé au client.'),
      error: (error) => this.error.set(apiError(error)),
    });
  }
}
