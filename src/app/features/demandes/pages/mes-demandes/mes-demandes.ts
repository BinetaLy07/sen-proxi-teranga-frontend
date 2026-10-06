import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Devis, TypeLigneDevis } from '../../../devis/data-access/devis.models';
import { DevisApiService } from '../../../devis/data-access/devis-api.service';
import { Demande } from '../../data-access/demande.models';
import { DemandeApiService } from '../../data-access/demande-api.service';
import { ETIQUETTES, PARCOURS, STATUTS_ANNULABLES } from '../../data-access/demande-statuts';
import { AvisClient } from '../../components/avis-client/avis-client';
import { PaiementClient } from '../../components/paiement-client/paiement-client';
import { PhotosDemande } from '../../components/photos-demande/photos-demande';
import { SuiviRendezVous } from '../../components/suivi-rendez-vous/suivi-rendez-vous';

// L'action qui demande un motif (une seule à la fois)
type ActionAvecMotif = 'revision' | 'refus' | 'annulation';

// « Mes demandes » : à gauche la liste, à droite le détail de la demande choisie
// Les blocs Rendez-vous, Paiement, Avis et Photos sont des petits composants à part
@Component({
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    SuiviRendezVous,
    PaiementClient,
    AvisClient,
    PhotosDemande,
  ],
  templateUrl: './mes-demandes.html',
})
export class MesDemandes {
  private readonly demandeApi = inject(DemandeApiService);
  private readonly devisApi = inject(DevisApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly parcours = PARCOURS;
  readonly etiquettes = ETIQUETTES;

  // ---------- La liste ----------
  readonly demandes = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- La demande choisie ----------
  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(
    () => this.demandes().find((d) => d.id === this.selectionId()) ?? null,
  );
  // La position dans la frise (-1 = statut de sortie : refusée, annulée, expirée, litige)
  readonly etape = computed(() => {
    const d = this.selection();
    return d ? this.parcours.findIndex((p) => p.statut === d.statut) : -1;
  });
  readonly annulable = computed(() => {
    const d = this.selection();
    return d ? STATUTS_ANNULABLES.includes(d.statut) : false;
  });

  // ---------- Le devis de la demande choisie ----------
  readonly devis = signal<Devis | null>(null);

  // ---------- Les actions ----------
  readonly action = signal<ActionAvecMotif | null>(null);
  readonly motif = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly actionSuccess = signal('');

  constructor() {
    this.charger();
  }

  // ===== Chargement =====

  // keepId : après une action, on garde la même demande ouverte
  charger(keepId: number | null = null) {
    this.loading.set(true);
    this.demandeApi
      .listerPourClient(this.clientId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.demandes.set(liste);
          const id = keepId ?? liste[0]?.id ?? null;
          if (id !== null) this.choisir(id, keepId !== null);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  choisir(id: number, garderMessages = false) {
    this.selectionId.set(id);
    this.action.set(null);
    this.motif.reset();
    this.actionError.set('');
    if (!garderMessages) this.actionSuccess.set('');
    this.chargerDevis(id);
  }

  // Une demande n'a pas toujours de devis : dans ce cas le backend répond 404, et on n'affiche rien
  private chargerDevis(demandeId: number) {
    this.devis.set(null);
    this.devisApi.actuel(demandeId).subscribe({
      next: (devis) => this.devis.set(devis),
      error: () => this.devis.set(null),
    });
  }

  // ===== Actions =====

  accepterDevis() {
    const d = this.selection();
    if (!d) return;
    this.executer(this.devisApi.accepter(this.clientId, d.id), 'Devis accepté.');
  }

  // Ouvre le petit formulaire « motif »
  ouvrir(action: ActionAvecMotif) {
    this.action.set(action);
    this.motif.reset();
    this.actionError.set('');
  }

  fermer() {
    this.action.set(null);
  }

  validerMotif() {
    const d = this.selection();
    const action = this.action();
    this.motif.markAsTouched();
    if (!d || !action || this.motif.invalid) return;
    const motif = this.motif.value.trim();
    if (action === 'revision') {
      this.executer(
        this.devisApi.demanderRevision(this.clientId, d.id, motif),
        'Demande de révision envoyée.',
      );
    } else if (action === 'refus') {
      this.executer(this.devisApi.refuser(this.clientId, d.id, motif), 'Devis refusé.');
    } else {
      this.executer(this.demandeApi.annuler(this.clientId, d.id, motif), 'Demande annulée.');
    }
  }

  // Envoie l'action au backend, puis recharge la liste (le statut a changé)
  private executer(requete: Observable<unknown>, succes: string) {
    const d = this.selection();
    if (!d || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.actionSuccess.set(succes);
        this.action.set(null);
        this.charger(d.id);
      },
      error: (error) => this.actionError.set(apiError(error)),
    });
  }

  // Un bloc (rendez-vous, paiement, avis) a fait une action : on affiche son message
  // et on recharge la liste, car le statut de la demande a changé
  apresAction(message: string) {
    this.actionSuccess.set(message);
    this.charger(this.selectionId());
  }

  // ===== Petites aides pour l'affichage =====

  montant(valeur: number | null) {
    return valeur == null ? '' : valeur.toLocaleString('fr-FR') + ' F';
  }

  typeLigne(type: TypeLigneDevis) {
    return type === 'MAIN_OEUVRE'
      ? 'Main-d’œuvre'
      : type === 'MATERIEL'
        ? 'Matériel'
        : 'Déplacement';
  }
}
