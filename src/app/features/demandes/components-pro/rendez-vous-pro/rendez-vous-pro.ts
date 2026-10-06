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

const STATUTS_VISIBLES: StatutDemande[] = [
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
  'CONFIRMEE',
  'CLOTUREE',
];

// Bloc « Rendez-vous » côté professionnel : proposer une date, reporter,
// puis commencer et terminer les travaux.
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
  readonly busy = signal(false);
  readonly error = signal('');
  readonly reporter = signal(false);

  // On propose une (nouvelle) date : pas encore de rendez-vous, ou il a été refusé / reporté
  readonly peutProposer = computed(() => {
    const r = this.rdv();
    return (
      this.demande().statut === 'DEVIS_ACCEPTE' &&
      (!r || r.statut === 'REFUSE' || r.statut === 'REPORTE')
    );
  });

  // Le champ « date et heure » du navigateur donne "2026-10-10T09:00"
  readonly dateHeure = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly maintenant = maintenantLocal();
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
    this.reporter.set(false);
    this.error.set('');
    this.dateHeure.reset();
    if (!this.visible()) return;
    this.api.actuel(demandeId).subscribe({
      next: (rdv) => {
        this.rdv.set(rdv);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore de rendez-vous
    });
  }

  proposer() {
    this.dateHeure.markAsTouched();
    if (this.dateHeure.invalid) return;
    // Le backend attend les secondes : "2026-10-10T09:00:00"
    this.executer(
      this.api.proposer(this.proId, this.demande().id, this.dateHeure.value + ':00'),
      'Date proposée au client.',
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

  validerReport() {
    this.motif.markAsTouched();
    if (this.motif.invalid) return;
    this.executer(
      this.api.reporterParPro(this.proId, this.demande().id, this.motif.value.trim()),
      'Rendez-vous reporté : proposez une nouvelle date.',
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

// La date et l'heure actuelles au format du champ "datetime-local" (AAAA-MM-JJTHH:MM)
function maintenantLocal() {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}
