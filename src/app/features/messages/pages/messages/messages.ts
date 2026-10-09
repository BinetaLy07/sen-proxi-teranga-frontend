import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { DiscussionDemande } from '../../../demandes/components/discussion-demande/discussion-demande';
import { Demande } from '../../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../../demandes/data-access/demande-api.service';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import { BarreSaisie } from '../../../../shared/components/barre-saisie/barre-saisie';
import { BulleMessage } from '../../../../shared/components/bulle-message/bulle-message';
import { Conversation, Message, Vocal } from '../../data-access/message.models';
import { MessageApiService } from '../../data-access/message-api.service';

// La conversation ouverte : une personne + une demande (ou null : question générale)
interface Ouverte {
  interlocuteurId: number;
  interlocuteurNom: string;
  demandeId: number | null;
  demandeTitre: string | null;
}

// « Messages » : comme sur un téléphone, on voit UNE chose à la fois.
// - /messages                       -> la discussion la plus récente, seule ;
// - /messages?liste=1               -> la liste de mes discussions (« ← Mes discussions ») ;
// - /messages?demande=20            -> la discussion d'une demande (bouton « Discuter avec… ») ;
// - /messages?avec=2&nom=Moussa…    -> une question générale (« Écrire à … » sur un profil).
// Tout passe par l'adresse : le bouton « retour » du navigateur fonctionne donc aussi.
// Une discussion seule a 2 liens en haut : « ← Mes discussions » et « Mes demandes ».
// - la conversation d'une demande s'affiche avec le bloc « Discussion » (messages + cartes
//   automatiques : devis, rendez-vous, paiement…) ;
// - une question générale s'affiche en simples messages.
// Les messages peuvent être écrits ou vocaux (comme WhatsApp).
@Component({
  imports: [DatePipe, NgTemplateOutlet, RouterLink, DiscussionDemande, BarreSaisie, BulleMessage],
  templateUrl: './messages.html',
})
export class Messages {
  private readonly api = inject(MessageApiService);
  private readonly demandeApi = inject(DemandeApiService);
  private readonly compteurs = inject(CompteursService);
  private readonly router = inject(Router);
  private readonly session = inject(AuthService).session();
  readonly moiId = this.session?.utilisateurId ?? 0;
  // Pour adapter les textes : un pro écrit à ses clients, un client écrit aux pros
  readonly estPro = this.session?.role === 'PROFESSIONNEL';
  // Le lien « Mes demandes » : la page des demandes, selon qui regarde
  readonly pageDemandes = this.estPro ? '/demandes-recues' : '/mes-demandes';

  // true : la liste de mes discussions (?liste=1) ; false : une discussion seule
  readonly modeListe = signal(false);

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
  // La barre du bas (champ + micro), pour la vider quand un texte est parti
  private readonly barre = viewChild(BarreSaisie);

  constructor() {
    // À chaque changement d'adresse (clic sur un lien, bouton « retour »…), on affiche
    // ce qu'elle demande. (La page n'est pas recréée quand seul le « ?… » change.)
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const avec = Number(params.get('avec')) || null;
        const demande = Number(params.get('demande')) || null;
        this.modeListe.set(params.get('liste') !== null);

        if (this.modeListe()) {
          this.ouverte.set(null);
          this.chargerConversations(false);
        } else if (demande !== null) {
          this.chargerConversations(false);
          this.ouvrirDemande(demande);
        } else if (avec !== null) {
          this.chargerConversations(false);
          this.ouvrir({
            interlocuteurId: avec,
            interlocuteurNom: params.get('nom') ?? '',
            demandeId: null,
            demandeTitre: null,
          });
        } else {
          // Menu « Messages » : on ouvre la discussion la plus récente
          this.ouverte.set(null);
          this.chargerConversations(true);
        }
      });

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

  // Dans la liste : cliquer une conversation l'ouvre seule (son adresse change)
  choisir(c: Conversation) {
    const queryParams =
      c.demandeId !== null
        ? { demande: c.demandeId }
        : { avec: c.interlocuteurId, nom: c.interlocuteurNom };
    void this.router.navigate(['/messages'], { queryParams });
  }

  // Les 2 premières lettres du nom, dans le rond (ex : « bineta ly » -> « BL »)
  initiales(nom: string) {
    return nom
      .split(' ')
      .filter((mot) => mot.length > 0)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  // La « clé » d'une conversation : la personne + la demande
  cle(c: { interlocuteurId: number; demandeId: number | null }) {
    return `${c.interlocuteurId}-${c.demandeId ?? 'general'}`;
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

  // « Supprimer pour moi » : le message disparaît de la liste
  retirer(messageId: number) {
    this.messages.update((liste) => liste.filter((m) => m.id !== messageId));
    this.chargerConversations(false);
  }

  // Un message a changé (ex : je viens de le supprimer) : on remplace l'ancien
  remplacer(message: Message) {
    this.messages.update((liste) => liste.map((m) => (m.id === message.id ? message : m)));
    this.chargerConversations(false);
  }

  // Questions générales : un message écrit (venant de la barre du bas)
  envoyerTexte(texte: string) {
    const o = this.ouverte();
    if (o === null || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .envoyer(o.interlocuteurId, texte)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (message) => {
          this.messages.update((liste) => [...liste, message]);
          this.barre()?.vider();
          this.chargerConversations(false);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // Questions générales : un message vocal (venant de la barre du bas)
  envoyerVocal(vocal: Vocal) {
    const o = this.ouverte();
    if (o === null || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .envoyerVocal(o.interlocuteurId, vocal)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (message) => {
          this.messages.update((liste) => [...liste, message]);
          this.chargerConversations(false);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
