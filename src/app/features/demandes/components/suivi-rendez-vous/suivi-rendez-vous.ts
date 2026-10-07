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
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import {
  dateFuture,
  dateParDefaut,
  maintenantLocal,
} from '../../../rendez-vous/data-access/date-heure';
import { RendezVous } from '../../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../../rendez-vous/data-access/rendez-vous-api.service';
import { Demande, StatutDemande } from '../../data-access/demande.models';

// Les statuts où le bloc « Rendez-vous » a un sens
const STATUTS_VISIBLES: StatutDemande[] = [
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
  'CONFIRMEE',
  'CLOTUREE',
  'EN_LITIGE',
];

// Où en est le rendez-vous, du point de vue du client ?
// - choisir  : c'est au client de choisir une date (la première, ou après un report)
// - attente  : le client a proposé une date, le pro doit répondre
// - repondre : le pro a proposé une autre date, le client doit répondre
// - confirme : la date est acceptée (puis travaux, fin des travaux…)
// - rien     : chargement en cours, ou rien à afficher
type EtapeClient = 'choisir' | 'attente' | 'repondre' | 'confirme' | 'rien';

// Bloc « Rendez-vous » côté client : choisir la date, accepter ou proposer
// une autre date, reporter, puis confirmer la fin des travaux.
@Component({
  selector: 'app-suivi-rendez-vous',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './suivi-rendez-vous.html',
})
export class SuiviRendezVous {
  private readonly api = inject(RendezVousApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  // La demande vient de la page « Mes demandes » ; on la prévient après chaque action
  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly rdv = signal<RendezVous | null>(null);
  readonly charge = signal(false);
  readonly autreDate = signal(false); // le formulaire « Proposer une autre date » est ouvert
  readonly reporter = signal(false); // le formulaire « Reporter » est ouvert
  readonly busy = signal(false);
  readonly error = signal('');

  readonly etape = computed<EtapeClient>(() => {
    const r = this.rdv();
    if (!this.charge()) return 'rien';
    if (this.demande().statut !== 'DEVIS_ACCEPTE') {
      return r?.statut === 'ACCEPTE' ? 'confirme' : 'rien';
    }
    if (r?.statut === 'PROPOSE') {
      return r.proposePar === 'CLIENT' ? 'attente' : 'repondre';
    }
    return 'choisir'; // pas encore de date, ou la date a été reportée
  });

  // Le champ « date et heure » du navigateur donne "2026-10-10T09:00"
  readonly maintenant = maintenantLocal();
  readonly dateHeure = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, dateFuture],
  });
  readonly motif = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });

  constructor() {
    // Chaque fois que la demande change, on recharge son rendez-vous
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande));
    });
  }

  private charger(demande: Demande) {
    this.rdv.set(null);
    this.charge.set(false);
    this.autreDate.set(false);
    this.reporter.set(false);
    this.error.set('');
    // On propose d'avance le jour souhaité dans la demande, à 9 h
    this.dateHeure.reset(dateParDefaut(demande.dateSouhaitee));
    if (!this.visible()) return;
    this.api.actuel(demande.id).subscribe({
      next: (rdv) => {
        this.rdv.set(rdv);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore de rendez-vous
    });
  }

  // « Proposer une autre date » : on ouvre le formulaire, vide
  ouvrirAutreDate() {
    this.autreDate.set(true);
    this.dateHeure.reset('');
    this.error.set('');
  }

  proposer() {
    this.dateHeure.markAsTouched();
    if (this.dateHeure.invalid) return;
    // Le backend attend les secondes : "2026-10-10T09:00:00"
    this.executer(
      this.api.proposerParClient(this.clientId, this.demande().id, this.dateHeure.value + ':00'),
      `Date proposée à ${this.demande().professionnelNom}.`,
    );
  }

  accepter() {
    this.executer(
      this.api.accepterParClient(this.clientId, this.demande().id),
      'Rendez-vous confirmé.',
    );
  }

  confirmerFin() {
    this.executer(
      this.api.confirmerFin(this.clientId, this.demande().id),
      'Merci ! Vous pouvez maintenant payer et donner votre avis.',
    );
  }

  ouvrirReport() {
    this.reporter.set(true);
    this.motif.reset();
    this.error.set('');
  }

  validerReport() {
    this.motif.markAsTouched();
    if (this.motif.invalid) return;
    this.executer(
      this.api.reporterParClient(this.clientId, this.demande().id, this.motif.value.trim()),
      'Rendez-vous reporté : choisissez une nouvelle date.',
    );
  }

  private executer(requete: Observable<unknown>, succes: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => this.actualise.emit(succes),
      error: (error) => this.error.set(apiError(error)),
    });
  }
}
