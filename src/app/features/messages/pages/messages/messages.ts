import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import { Conversation, Message } from '../../data-access/message.models';
import { MessageApiService } from '../../data-access/message-api.service';

// La conversation ouverte : une personne + une demande (ou null : question générale)
interface Ouverte {
  interlocuteurId: number;
  interlocuteurNom: string;
  demandeId: number | null;
  demandeTitre: string | null;
}

// « Messages » : à gauche les conversations, à droite la discussion ouverte.
// Avec la même personne, il y a une conversation par demande, plus les « questions générales ».
// On peut arriver ici avec ?avec=2&nom=Moussa%20Fall pour poser une question générale
// (ex : depuis le profil d'un pro).
@Component({ imports: [DatePipe, ReactiveFormsModule, RouterLink], templateUrl: './messages.html' })
export class Messages {
  private readonly api = inject(MessageApiService);
  private readonly compteurs = inject(CompteursService);
  private readonly session = inject(AuthService).session();
  readonly moiId = this.session?.utilisateurId ?? 0;
  // Pour adapter les textes : un pro écrit à ses clients, un client écrit aux pros
  readonly estPro = this.session?.role === 'PROFESSIONNEL';
  // La page où se trouve une demande (pour le lien « Voir la demande »)
  readonly pageDemandes = this.estPro ? '/demandes-recues' : '/mes-demandes';

  readonly conversations = signal<Conversation[]>([]);
  readonly ouverte = signal<Ouverte | null>(null);
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
    if (avec !== null) {
      this.ouvrir({
        interlocuteurId: avec,
        interlocuteurNom: nom,
        demandeId: null,
        demandeTitre: null,
      });
    }

    // Toutes les 15 secondes, on regarde s'il y a du nouveau
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.chargerConversations(false);
        const o = this.ouverte();
        if (o !== null) this.chargerMessages(o);
      });
  }

  // La « clé » d'une conversation : la personne + la demande
  cle(c: { interlocuteurId: number; demandeId: number | null }) {
    return `${c.interlocuteurId}-${c.demandeId ?? 'general'}`;
  }

  estOuverte(c: Conversation) {
    const o = this.ouverte();
    return o !== null && this.cle(o) === this.cle(c);
  }

  // ouvrirLaPremiere : à l'arrivée sur la page, on ouvre la conversation la plus récente
  chargerConversations(ouvrirLaPremiere: boolean) {
    this.api
      .conversations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.conversations.set(liste);
          if (ouvrirLaPremiere && liste.length > 0 && this.ouverte() === null) {
            this.ouvrir(liste[0]);
          }
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  ouvrir(c: Ouverte) {
    this.ouverte.set({
      interlocuteurId: c.interlocuteurId,
      interlocuteurNom: c.interlocuteurNom,
      demandeId: c.demandeId,
      demandeTitre: c.demandeTitre,
    });
    this.messages.set([]);
    this.error.set('');
    this.chargerMessages(c);
  }

  // Ouvrir une conversation marque ses messages comme lus : on met à jour le menu
  private chargerMessages(c: Ouverte) {
    const requete =
      c.demandeId !== null ? this.api.deLaDemande(c.demandeId) : this.api.avec(c.interlocuteurId);
    requete.subscribe({
      next: (liste) => {
        const o = this.ouverte();
        if (o === null || this.cle(o) !== this.cle(c)) return;
        this.messages.set(liste);
        this.compteurs.rafraichir();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  // Appelé par (submit) du formulaire : preventDefault() empêche le navigateur
  // de recharger toute la page (son comportement normal quand on envoie un <form>)
  envoyer(event?: Event) {
    event?.preventDefault();
    const o = this.ouverte();
    this.texte.markAsTouched();
    if (o === null || this.texte.invalid || this.busy()) return;
    const contenu = this.texte.value.trim();
    const requete =
      o.demandeId !== null
        ? this.api.envoyerDansDemande(o.demandeId, contenu)
        : this.api.envoyer(o.interlocuteurId, contenu);
    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (message) => {
        this.messages.update((liste) => [...liste, message]);
        this.texte.reset();
        this.chargerConversations(false);
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }
}
