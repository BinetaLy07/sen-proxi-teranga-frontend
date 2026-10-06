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
  MODES_PAIEMENT,
  ModePaiement,
  Paiement,
} from '../../../paiements/data-access/paiement.models';
import { PaiementApiService } from '../../../paiements/data-access/paiement-api.service';
import { Demande, StatutDemande } from '../../data-access/demande.models';

const STATUTS_VISIBLES: StatutDemande[] = ['CONFIRMEE', 'CLOTUREE', 'EN_LITIGE'];

// Bloc « Paiement » côté professionnel : confirmer ou contester le paiement déclaré
// par le client, ou enregistrer soi-même un paiement reçu en espèces.
@Component({
  selector: 'app-paiement-pro',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './paiement-pro.html',
})
export class PaiementPro {
  private readonly api = inject(PaiementApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly paiement = signal<Paiement | null>(null);
  readonly charge = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly contester = signal(false);
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
    this.paiement.set(null);
    this.charge.set(false);
    this.contester.set(false);
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
    return MODES_PAIEMENT.find((m) => m.valeur === mode)?.libelle ?? mode;
  }

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F CFA';
  }

  confirmer() {
    this.executer(
      this.api.confirmer(this.proId, this.demande().id),
      'Paiement confirmé : la demande est clôturée.',
    );
  }

  especes() {
    this.executer(
      this.api.enregistrerEspeces(this.proId, this.demande().id),
      'Paiement en espèces enregistré : la demande est clôturée.',
    );
  }

  validerContestation() {
    this.motif.markAsTouched();
    if (this.motif.invalid) return;
    this.executer(
      this.api.contester(this.proId, this.demande().id, this.motif.value.trim()),
      'Paiement contesté : l’administrateur va examiner le dossier.',
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
