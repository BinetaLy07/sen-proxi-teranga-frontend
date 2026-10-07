import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { DiscussionDemande } from '../../../demandes/components/discussion-demande/discussion-demande';
import { Demande } from '../../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../../demandes/data-access/demande-api.service';
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
// - la conversation d'une demande s'affiche avec le bloc « Discussion » (messages + cartes
//   automatiques : devis, rendez-vous, paiement…) ;
// - une question générale s'affiche en simples messages.
// On peut arriver ici avec ?demande=20 (bouton « Discuter avec… » d'une demande)
// ou avec ?avec=2&nom=Moussa%20Fall (question générale, ex : depuis le profil d'un pro).
@Component({
  imports: [DatePipe, ReactiveFormsModule, DiscussionDemande],
  templateUrl: './messages.html',
})
export class Messages {
  private readonly api = inject(MessageApiService);
  private readonly demandeApi = inject(DemandeApiService);
  private readonly compteurs = inject(CompteursService);
  private readonly session = inject(AuthService).session();
  readonly moiId = this.session?.utilisateurId ?? 0;
  // Pour adapter les textes : un pro écrit à ses clients, un client écrit aux pros
  readonly estPro = this.session?.role === 'PROFESSIONNEL';

  readonly conversations = signal<Conversation[]>([]);
  readonly ouverte = signal<Ouverte | null>(null);
  // La demande de la conversation ouverte (null pour une question générale)
  readonly demandeOuverte = signal<Demande | null>(null);
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
    const demande = Number(params.get('demande')) || null;

    this.chargerConversations(avec === null && demande === null);
    if (demande !== null) {
      this.ouvrirDemande(demande);
    } else if (avec !== null) {
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
        // (la discussion d'une demande se met à jour toute seule)
        const o = this.ouverte();
        if (o !== null && o.demandeId === null) this.chargerMessages(o);
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
    this.demandeOuverte.set(null);
    this.error.set('');
    if (c.demandeId !== null) {
      this.chargerDemande(c.demandeId);
    } else {
      this.chargerMessages(c);
    }
  }

  // Arrivée avec ?demande=20 : on charge la demande pour connaître le nom de l'autre
  private ouvrirDemande(demandeId: number) {
    this.demandeApi.detail(demandeId).subscribe({
      next: (d) =>
        this.ouvrir({
          interlocuteurId: this.estPro ? d.clientId : d.professionnelId,
          interlocuteurNom: this.estPro ? d.clientNom : d.professionnelNom,
          demandeId: d.id,
          demandeTitre: d.serviceTitre,
        }),
      error: (error) => this.error.set(apiError(error)),
    });
  }

  private chargerDemande(demandeId: number) {
    this.demandeApi.detail(demandeId).subscribe({
      next: (d) => {
        if (this.ouverte()?.demandeId === d.id) this.demandeOuverte.set(d);
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  // Questions générales : ouvrir la conversation marque ses messages comme lus
  private chargerMessages(c: Ouverte) {
    this.api.avec(c.interlocuteurId).subscribe({
      next: (liste) => {
        const o = this.ouverte();
        if (o === null || this.cle(o) !== this.cle(c)) return;
        this.messages.set(liste);
        this.compteurs.rafraichir();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  // Questions générales. Appelé par (submit) du formulaire : preventDefault() empêche le navigateur
  // de recharger toute la page (son comportement normal quand on envoie un <form>)
  envoyer(event?: Event) {
    event?.preventDefault();
    const o = this.ouverte();
    this.texte.markAsTouched();
    if (o === null || this.texte.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .envoyer(o.interlocuteurId, this.texte.value.trim())
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
