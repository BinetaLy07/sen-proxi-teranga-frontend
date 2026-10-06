import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import { Conversation, Message } from '../../data-access/message.models';
import { MessageApiService } from '../../data-access/message-api.service';

// « Messages » : à gauche les conversations, à droite la discussion ouverte.
// On peut arriver ici avec ?avec=2&nom=Moussa%20Fall pour écrire à quelqu'un de nouveau.
@Component({ imports: [DatePipe, ReactiveFormsModule], templateUrl: './messages.html' })
export class Messages {
  private readonly api = inject(MessageApiService);
  private readonly compteurs = inject(CompteursService);
  readonly moiId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly conversations = signal<Conversation[]>([]);
  readonly interlocuteurId = signal<number | null>(null);
  readonly interlocuteurNom = signal('');
  readonly messages = signal<Message[]>([]);
  // Affichés du plus récent au plus ancien dans une colonne inversée :
  // ainsi la discussion reste collée en bas, comme sur WhatsApp
  readonly messagesInverses = computed(() => [...this.messages()].reverse());

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly texte = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const avec = Number(params.get('avec')) || null;
    const nom = params.get('nom') ?? '';

    this.chargerConversations(avec === null);
    if (avec !== null) this.ouvrir(avec, nom);

    // Toutes les 15 secondes, on regarde s'il y a du nouveau
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.chargerConversations(false);
        const id = this.interlocuteurId();
        if (id !== null) this.chargerMessages(id);
      });
  }

  // ouvrirLaPremiere : à l'arrivée sur la page, on ouvre la conversation la plus récente
  chargerConversations(ouvrirLaPremiere: boolean) {
    this.api
      .conversations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.conversations.set(liste);
          if (ouvrirLaPremiere && liste.length > 0 && this.interlocuteurId() === null) {
            this.ouvrir(liste[0].interlocuteurId, liste[0].interlocuteurNom);
          }
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  ouvrir(id: number, nom: string) {
    this.interlocuteurId.set(id);
    this.interlocuteurNom.set(
      nom || this.conversations().find((c) => c.interlocuteurId === id)?.interlocuteurNom || '',
    );
    this.messages.set([]);
    this.error.set('');
    this.chargerMessages(id);
  }

  // Ouvrir une conversation marque ses messages comme lus : on met à jour le menu
  private chargerMessages(id: number) {
    this.api.avec(id).subscribe({
      next: (liste) => {
        if (this.interlocuteurId() !== id) return;
        this.messages.set(liste);
        this.compteurs.rafraichir();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  envoyer() {
    const id = this.interlocuteurId();
    this.texte.markAsTouched();
    if (id === null || this.texte.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .envoyer(id, this.texte.value.trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (message) => {
          this.messages.update((liste) => [...liste, message]);
          this.texte.reset();
          this.chargerConversations(false);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
