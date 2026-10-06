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

// L'avis est demandé dès que le client a confirmé la fin des travaux
const STATUTS_VISIBLES: StatutDemande[] = ['CONFIRMEE', 'CLOTUREE', 'EN_LITIGE'];

// Bloc « Votre avis » : une note de 1 à 5 étoiles et un commentaire facultatif (une seule fois)
@Component({
  selector: 'app-avis-client',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './avis-client.html',
})
export class AvisClient {
  private readonly api = inject(AvisApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  readonly actualise = output<string>();

  readonly etoiles = [1, 2, 3, 4, 5];
  readonly visible = computed(() => STATUTS_VISIBLES.includes(this.demande().statut));
  readonly avis = signal<Avis | null>(null);
  readonly charge = signal(false);
  readonly note = signal(0);
  readonly commentaire = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)],
  });
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });
  }

  private charger(demandeId: number) {
    this.avis.set(null);
    this.charge.set(false);
    this.note.set(0);
    this.error.set('');
    if (!this.visible()) return;
    this.api.deDemande(demandeId).subscribe({
      next: (avis) => {
        this.avis.set(avis);
        this.charge.set(true);
      },
      error: () => this.charge.set(true), // 404 : pas encore d'avis
    });
  }

  envoyer() {
    if (this.busy()) return;
    if (this.note() === 0) {
      this.error.set('Choisissez une note de 1 à 5 étoiles.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .donner(this.clientId, this.demande().id, this.note(), this.commentaire.value.trim() || null)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.actualise.emit('Merci pour votre avis !'),
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
