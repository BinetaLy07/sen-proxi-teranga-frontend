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
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { AvisApiService } from '../../../avis/data-access/avis-api.service';
import { Avis } from '../../../professionnels/data-access/professionnel.models';
import { Demande, StatutDemande } from '../../data-access/demande.models';

const STATUTS_VISIBLES: StatutDemande[] = ['CONFIRMEE', 'CLOTUREE', 'EN_LITIGE'];

// Bloc « Avis du client » côté professionnel : lire l'avis et y répondre (une seule fois)
@Component({
  selector: 'app-avis-pro',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './avis-pro.html',
})
export class AvisPro {
  private readonly api = inject(AvisApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly etoiles = [1, 2, 3, 4, 5];
  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly avis = signal<Avis | null>(null);
  readonly charge = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly reponse = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  constructor() {
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.avis.set(null);
    this.charge.set(false);
    this.error.set('');
    this.reponse.reset();
    if (!this.visible()) return;
    this.api.deDemande(demandeId).subscribe({
      next: (avis) => {
        this.avis.set(avis);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore d'avis
    });
  }

  repondre() {
    this.reponse.markAsTouched();
    if (this.reponse.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .repondre(this.proId, this.demande().id, this.reponse.value.trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.actualise.emit('Réponse publiée sous l’avis.'),
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
