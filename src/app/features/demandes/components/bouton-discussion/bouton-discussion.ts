import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { MessageApiService } from '../../../messages/data-access/message-api.service';
import { Demande } from '../../data-access/demande.models';

// Le bouton « 💬 Discuter avec … » d'une demande.
// La discussion elle-même est dans la page Messages : ce bouton ouvre la bonne conversation
// et affiche le nombre de messages pas encore lus.
@Component({
  selector: 'app-bouton-discussion',
  imports: [RouterLink],
  template: `
    <a
      routerLink="/messages"
      [queryParams]="{ demande: demande().id }"
      class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 font-semibold text-indigo-900 hover:bg-indigo-50"
    >
      <span><span aria-hidden="true">💬</span> Discuter avec {{ autreNom() }}</span>
      <span class="flex items-center gap-2">
        @if (nonLus() > 0) {
          <span
            class="flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white"
            >{{ nonLus() }}<span class="sr-only"> message(s) non lu(s)</span></span
          >
        }
        <span aria-hidden="true">→</span>
      </span>
    </a>
  `,
})
export class BoutonDiscussion {
  private readonly api = inject(MessageApiService);
  private readonly role = inject(AuthService).session()?.role;

  readonly demande = input.required<Demande>();
  readonly nonLus = signal(0);

  readonly autreNom = computed(() =>
    this.role === 'PROFESSIONNEL' ? this.demande().clientNom : this.demande().professionnelNom,
  );

  constructor() {
    // Le nombre de non lus vient de la liste des conversations (une par demande)
    effect(() => {
      const id = this.demande().id;
      untracked(() =>
        this.api.conversations().subscribe({
          next: (liste) =>
            this.nonLus.set(liste.find((c) => c.demandeId === id)?.nombreNonLus ?? 0),
          error: () => this.nonLus.set(0),
        }),
      );
    });
  }
}
