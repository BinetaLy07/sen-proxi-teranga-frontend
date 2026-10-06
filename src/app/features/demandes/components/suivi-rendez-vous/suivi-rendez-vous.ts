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

// Bloc « Rendez-vous » côté client : accepter ou refuser la date proposée,
// reporter, puis confirmer la fin des travaux.
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
  readonly action = signal<'refus' | 'report' | null>(null);
  readonly motif = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    // Chaque fois que la demande change, on recharge son rendez-vous
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.rdv.set(null);
    this.action.set(null);
    this.error.set('');
    if (!this.visible()) return;
    this.api.actuel(demandeId).subscribe({
      next: (rdv) => this.rdv.set(rdv),
      error: () => this.rdv.set(null), // 404 : pas encore de rendez-vous
    });
  }

  accepter() {
    this.executer(this.api.accepter(this.clientId, this.demande().id), 'Rendez-vous accepté.');
  }

  confirmerFin() {
    this.executer(
      this.api.confirmerFin(this.clientId, this.demande().id),
      'Merci ! Vous pouvez maintenant payer et donner votre avis.',
    );
  }

  ouvrir(action: 'refus' | 'report') {
    this.action.set(action);
    this.motif.reset();
    this.error.set('');
  }

  validerMotif() {
    this.motif.markAsTouched();
    if (this.motif.invalid) return;
    const motif = this.motif.value.trim();
    const id = this.demande().id;
    if (this.action() === 'refus') {
      this.executer(this.api.refuser(this.clientId, id, motif), 'Date refusée.');
    } else {
      this.executer(this.api.reporterParClient(this.clientId, id, motif), 'Rendez-vous reporté.');
    }
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
