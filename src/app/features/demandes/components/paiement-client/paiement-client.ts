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
import {
  MODES_PAIEMENT,
  ModePaiement,
  Paiement,
} from '../../../paiements/data-access/paiement.models';
import { PaiementApiService } from '../../../paiements/data-access/paiement-api.service';
import { Demande, StatutDemande } from '../../data-access/demande.models';

const STATUTS_VISIBLES: StatutDemande[] = ['CONFIRMEE', 'CLOTUREE', 'EN_LITIGE'];

// Bloc « Paiement » côté client : après la confirmation de fin des travaux,
// le client déclare comment il a payé. Le pro confirme (ou c'est automatique après 48 h).
@Component({
  selector: 'app-paiement-client',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './paiement-client.html',
})
export class PaiementClient {
  private readonly api = inject(PaiementApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  // Le montant du devis accepté (affiché pour information)
  readonly montant = input<number | null>(null);
  readonly actualise = output<string>();

  readonly modes = MODES_PAIEMENT;
  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly paiement = signal<Paiement | null>(null);
  readonly charge = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    modePaiement: ['WAVE' as ModePaiement, Validators.required],
    reference: ['', Validators.maxLength(100)],
  });

  constructor() {
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.paiement.set(null);
    this.charge.set(false);
    this.error.set('');
    if (!this.visible()) return;
    this.api.deDemande(demandeId).subscribe({
      next: (paiement) => {
        this.paiement.set(paiement);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore de paiement
    });
  }

  libelleMode(mode: ModePaiement) {
    return this.modes.find((m) => m.valeur === mode)?.libelle ?? mode;
  }

  montantTexte(valeur: number | null) {
    return valeur == null ? '' : valeur.toLocaleString('fr-FR') + ' F CFA';
  }

  declarer() {
    if (this.busy() || this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.api
      .declarer(
        this.clientId,
        this.demande().id,
        v.modePaiement,
        v.modePaiement === 'ESPECES' ? null : v.reference.trim() || null,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.actualise.emit('Paiement déclaré. Le professionnel doit le confirmer.'),
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
