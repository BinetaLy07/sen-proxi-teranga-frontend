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
import { dateFuture, maintenantLocal } from '../../../rendez-vous/data-access/date-heure';
import { RendezVous } from '../../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../../rendez-vous/data-access/rendez-vous-api.service';
import { Demande, StatutDemande } from '../../data-access/demande.models';

const STATUTS_VISIBLES: StatutDemande[] = [
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
  'CONFIRMEE',
  'CLOTUREE',
];

// Où en est le rendez-vous, du point de vue du professionnel ?
// - client   : c'est au client de choisir une date (la première, ou après un report)
// - repondre : le client a proposé une date, le pro doit répondre
// - attente  : le pro a proposé une autre date, le client doit répondre
// - confirme : la date est acceptée (puis travaux, fin des travaux…)
// - rien     : chargement en cours, ou rien à afficher
type EtapePro = 'client' | 'repondre' | 'attente' | 'confirme' | 'rien';

// Bloc « Rendez-vous » côté professionnel : accepter la date du client ou en
// proposer une autre, reporter, puis commencer et terminer les travaux.
@Component({
  selector: 'app-rendez-vous-pro',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './rendez-vous-pro.html',
})
export class RendezVousPro {
  private readonly api = inject(RendezVousApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly rdv = signal<RendezVous | null>(null);
  readonly charge = signal(false);
  readonly autreDate = signal(false); // le formulaire « Proposer une autre date » est ouvert
  readonly reporter = signal(false); // le formulaire « Reporter » est ouvert
  readonly busy = signal(false);
  readonly error = signal('');

  readonly etape = computed<EtapePro>(() => {
    const r = this.rdv();
    if (!this.charge()) return 'rien';
    if (this.demande().statut !== 'DEVIS_ACCEPTE') {
      return r?.statut === 'ACCEPTE' ? 'confirme' : 'rien';
    }
    if (r?.statut === 'PROPOSE') {
      return r.proposePar === 'CLIENT' ? 'repondre' : 'attente';
    }
    return 'client'; // pas encore de date, ou la date a été reportée
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
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.rdv.set(null);
    this.charge.set(false);
    this.autreDate.set(false);
    this.reporter.set(false);
    this.error.set('');
    this.dateHeure.reset('');
    if (!this.visible()) return;
    this.api.actuel(demandeId).subscribe({
      next: (rdv) => {
        this.rdv.set(rdv);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore de rendez-vous
    });
  }

  accepter() {
    this.executer(
      this.api.accepterParPro(this.proId, this.demande().id),
      'Rendez-vous confirmé : le client est prévenu.',
    );
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
      this.api.proposerParPro(this.proId, this.demande().id, this.dateHeure.value + ':00'),
      'Autre date proposée au client.',
    );
  }

  commencer() {
    this.executer(this.api.commencer(this.proId, this.demande().id), 'Travaux commencés.');
  }

  terminer() {
    this.executer(
      this.api.terminer(this.proId, this.demande().id),
      'Travaux terminés : le client doit confirmer.',
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
      this.api.reporterParPro(this.proId, this.demande().id, this.motif.value.trim()),
      'Rendez-vous reporté : le client va choisir une nouvelle date.',
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
