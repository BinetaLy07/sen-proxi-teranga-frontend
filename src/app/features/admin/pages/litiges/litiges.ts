import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Demande } from '../../../demandes/data-access/demande.models';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import {
  MODES_PAIEMENT,
  ModePaiement,
  Paiement,
} from '../../../paiements/data-access/paiement.models';
import { PaiementApiService } from '../../../paiements/data-access/paiement-api.service';
import { DiscussionDemande } from '../../../demandes/components/discussion-demande/discussion-demande';
import { DecisionLitige } from '../../data-access/admin.models';
import { AdminApiService } from '../../data-access/admin-api.service';

// Les deux décisions, expliquées à l'administrateur
const DECISIONS: { valeur: DecisionLitige; titre: string; explication: string }[] = [
  {
    valeur: 'PAIEMENT_RECU',
    titre: 'Paiement reçu',
    explication: 'La preuve est acceptée : le paiement est confirmé et le dossier est clôturé.',
  },
  {
    valeur: 'DOSSIER_ANNULE',
    titre: 'Annuler le dossier',
    explication:
      "Le paiement n'est pas prouvé : la demande est annulée, la suite se règle hors de l'application.",
  },
];

// « Litiges » : le pro a contesté un paiement déclaré par le client.
// L'administrateur examine le dossier puis tranche, avec une explication.
// On peut arriver ici avec ?demande=18 (tableau de bord).
@Component({
  imports: [DatePipe, ReactiveFormsModule, DiscussionDemande],
  templateUrl: './litiges.html',
})
export class Litiges {
  private readonly adminApi = inject(AdminApiService);
  private readonly paiementApi = inject(PaiementApiService);
  private readonly compteurs = inject(CompteursService);

  readonly decisions = DECISIONS;

  // ---------- La liste ----------
  readonly litiges = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- Le dossier choisi ----------
  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(
    () => this.litiges().find((d) => d.id === this.selectionId()) ?? null,
  );
  readonly paiement = signal<Paiement | null>(null);

  // ---------- La décision ----------
  readonly form = inject(FormBuilder).nonNullable.group({
    decision: ['' as DecisionLitige | '', Validators.required],
    explication: ['', [Validators.required, Validators.maxLength(500)]],
  });
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly actionSuccess = signal('');

  constructor() {
    const idVoulu = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('demande')) || null;
    this.adminApi
      .litiges()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.litiges.set(liste);
          const id = liste.some((d) => d.id === idVoulu) ? idVoulu : (liste[0]?.id ?? null);
          if (id !== null) this.choisir(id);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  choisir(id: number) {
    this.selectionId.set(id);
    this.form.reset();
    this.actionError.set('');
    // Le paiement contesté : montant, moyen, référence, motif du pro
    this.paiement.set(null);
    this.paiementApi.deDemande(id).subscribe({
      next: (paiement) => {
        if (this.selectionId() === id) this.paiement.set(paiement);
      },
    });
  }

  trancher() {
    const d = this.selection();
    this.form.markAllAsTouched();
    if (!d || this.form.invalid || this.busy()) return;
    const { decision, explication } = this.form.getRawValue();
    if (decision === '') return;

    this.busy.set(true);
    this.actionError.set('');
    this.adminApi
      .resoudreLitige(d.id, decision, explication.trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (demande) => {
          this.actionSuccess.set(
            `Litige réglé (dossier n° ${demande.id}) : ` +
              (demande.statut === 'CLOTUREE' ? 'dossier clôturé.' : 'dossier annulé.') +
              ' Le client et le professionnel sont prévenus.',
          );
          // Le dossier n'est plus en litige : on le retire et on ouvre le suivant
          const reste = this.litiges().filter((x) => x.id !== demande.id);
          this.litiges.set(reste);
          this.selectionId.set(null);
          this.paiement.set(null);
          if (reste.length > 0) this.choisir(reste[0].id);
          this.compteurs.rafraichir(); // le chiffre rouge du menu
        },
        error: (error) => this.actionError.set(apiError(error)),
      });
  }

  // ===== Petites aides pour l'affichage =====

  invalid(nom: 'decision' | 'explication') {
    const champ = this.form.controls[nom];
    return champ.touched && champ.invalid;
  }

  modeLibelle(mode: ModePaiement) {
    return MODES_PAIEMENT.find((m) => m.valeur === mode)?.libelle ?? mode;
  }

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }
}
