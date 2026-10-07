import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Paiement } from '../../../paiements/data-access/paiement.models';
import { PaiementApiService } from '../../../paiements/data-access/paiement-api.service';
import { ProfessionnelApiService } from '../../../professionnels/data-access/professionnel-api.service';
import { PhotosDemande } from '../../components/photos-demande/photos-demande';
import { AvisPro } from '../../components-pro/avis-pro/avis-pro';
import { DevisPro } from '../../components-pro/devis-pro/devis-pro';
import { PaiementPro } from '../../components-pro/paiement-pro/paiement-pro';
import { RendezVousPro } from '../../components-pro/rendez-vous-pro/rendez-vous-pro';
import { Demande, StatutDemande } from '../../data-access/demande.models';
import { DemandeApiService } from '../../data-access/demande-api.service';
import {
  ETIQUETTES_PRO,
  phraseAttente,
  STATUTS_ANNULABLES,
} from '../../data-access/demande-statuts';
import { BoutonDiscussion } from '../../components/bouton-discussion/bouton-discussion';

type Filtre = 'toutes' | 'nouvelles' | 'en-cours' | 'terminees' | 'autres';

const EN_COURS: StatutDemande[] = [
  'ACCEPTEE',
  'DEVIS_ENVOYE',
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
];
const TERMINEES: StatutDemande[] = ['CONFIRMEE', 'CLOTUREE'];

// « Demandes reçues » : l'espace de travail du professionnel.
// À gauche la liste (avec filtres), à droite la demande choisie et ses blocs
// (devis, rendez-vous, paiement, avis) qui apparaissent selon le statut.
@Component({
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PhotosDemande,
    DevisPro,
    RendezVousPro,
    PaiementPro,
    AvisPro,
    BoutonDiscussion,
  ],
  templateUrl: './demandes-recues.html',
})
export class DemandesRecues {
  private readonly demandeApi = inject(DemandeApiService);
  private readonly paiementApi = inject(PaiementApiService);
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly etiquettes = ETIQUETTES_PRO;

  // ---------- En-tête : prénom, note, paiements à confirmer ----------
  readonly prenom = signal('');
  readonly note = signal<{ moyenne: number; nombre: number } | null>(null);
  readonly paiementsAConfirmer = signal<Paiement[]>([]);

  // ---------- La liste ----------
  readonly demandes = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filtre = signal<Filtre>('toutes');

  readonly compteurs = computed(() => {
    const liste = this.demandes();
    return {
      toutes: liste.length,
      nouvelles: liste.filter((d) => d.statut === 'CREEE').length,
      enCours: liste.filter((d) => EN_COURS.includes(d.statut)).length,
      terminees: liste.filter((d) => TERMINEES.includes(d.statut)).length,
      autres: liste.filter(
        (d) =>
          d.statut !== 'CREEE' && !EN_COURS.includes(d.statut) && !TERMINEES.includes(d.statut),
      ).length,
    };
  });

  readonly filtrees = computed(() => {
    const liste = this.demandes();
    switch (this.filtre()) {
      case 'nouvelles':
        return liste.filter((d) => d.statut === 'CREEE');
      case 'en-cours':
        return liste.filter((d) => EN_COURS.includes(d.statut));
      case 'terminees':
        return liste.filter((d) => TERMINEES.includes(d.statut));
      case 'autres':
        return liste.filter(
          (d) =>
            d.statut !== 'CREEE' && !EN_COURS.includes(d.statut) && !TERMINEES.includes(d.statut),
        );
      default:
        return liste;
    }
  });

  // ---------- La demande choisie ----------
  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(
    () => this.demandes().find((d) => d.id === this.selectionId()) ?? null,
  );
  // La phrase « où on en est » (seulement quand c'est au client d'agir)
  readonly attente = computed(() => {
    const d = this.selection();
    return d ? phraseAttente(d, 'PROFESSIONNEL') : null;
  });
  // Le pro peut annuler après avoir accepté (avant « En cours ») ; avant, il refuse
  readonly annulable = computed(() => {
    const d = this.selection();
    return d ? d.statut !== 'CREEE' && STATUTS_ANNULABLES.includes(d.statut) : false;
  });

  // ---------- Les actions sur la demande ----------
  readonly action = signal<'refus' | 'annulation' | null>(null);
  readonly fraisVisite = new FormControl<number | null>(null, Validators.min(0));
  readonly motif = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly actionSuccess = signal('');

  // Arrivée depuis une notification : /demandes-recues?demande=18 ouvre la demande 18
  private readonly demandeDemandee =
    Number(inject(ActivatedRoute).snapshot.queryParamMap.get('demande')) || null;

  constructor() {
    this.professionnelApi.monProfil(this.proId).subscribe({
      next: (p) => {
        this.prenom.set(p.prenom);
        this.note.set({ moyenne: p.noteMoyenne, nombre: p.nombreAvis });
      },
    });
    this.charger(this.demandeDemandee);
  }

  // ===== Chargement =====

  charger(keepId: number | null = null) {
    this.loading.set(true);
    this.demandeApi
      .listerPourPro(this.proId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.demandes.set(liste);
          const id = keepId ?? liste[0]?.id ?? null;
          if (id !== null) this.choisir(id, keepId !== null);
        },
        error: (error) => this.error.set(apiError(error)),
      });
    this.paiementApi.listerPourPro(this.proId).subscribe({
      next: (liste) => this.paiementsAConfirmer.set(liste.filter((p) => p.statut === 'DECLARE')),
    });
  }

  choisir(id: number, garderMessages = false) {
    this.selectionId.set(id);
    this.action.set(null);
    this.motif.reset();
    this.fraisVisite.reset();
    this.actionError.set('');
    if (!garderMessages) this.actionSuccess.set('');
  }

  // ===== Accepter / refuser / annuler =====

  accepter() {
    const d = this.selection();
    if (!d || this.fraisVisite.invalid) return;
    const frais = d.visiteDemandee ? this.fraisVisite.value : null;
    this.executer(this.demandeApi.accepter(this.proId, d.id, frais), 'Demande acceptée.');
  }

  ouvrir(action: 'refus' | 'annulation') {
    this.action.set(action);
    this.motif.reset();
    this.actionError.set('');
  }

  validerMotif() {
    const d = this.selection();
    this.motif.markAsTouched();
    if (!d || this.motif.invalid) return;
    const motif = this.motif.value.trim();
    if (this.action() === 'refus') {
      this.executer(this.demandeApi.refuser(this.proId, d.id, motif), 'Demande refusée.');
    } else {
      this.executer(this.demandeApi.annulerParPro(this.proId, d.id, motif), 'Demande annulée.');
    }
  }

  // Un bloc (devis, rendez-vous, paiement, avis) a fait une action
  apresAction(message: string) {
    this.actionSuccess.set(message);
    this.charger(this.selectionId());
  }

  private executer(requete: Observable<unknown>, succes: string) {
    const d = this.selection();
    if (!d || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.action.set(null);
        this.apresAction(succes);
      },
      error: (error) => this.actionError.set(apiError(error)),
    });
  }

  // ===== Petites aides pour l'affichage =====

  noteTexte(valeur: number) {
    return valeur.toFixed(1).replace('.', ',');
  }

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }
}
