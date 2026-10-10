import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Demande } from '../../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../../demandes/data-access/demande-api.service';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import { BarreSaisie } from '../../../../shared/components/barre-saisie/barre-saisie';
import { BulleMessage } from '../../../../shared/components/bulle-message/bulle-message';
import { Conversation, Message, Vocal } from '../../data-access/message.models';
import { MessageApiService } from '../../data-access/message-api.service';

// La personne avec qui on discute
interface Ouverte {
  interlocuteurId: number;
  interlocuteurNom: string;
}

// Un message à afficher, avec (si besoin) l'étiquette de la demande dont il parle
interface Ligne {
  message: Message;
  etiquette: string | null; // ex : « 📋 Éclairage d'une boutique » ou « 💬 Question générale »
}

// « Messages » = LA CONVERSATION, comme WhatsApp : UNE discussion par personne.
// Les questions générales et les messages de toutes les demandes avec cette personne
// sont ensemble ; une petite étiquette dit de quelle demande on parle.
// Le suivi (devis, rendez-vous, paiement…) reste dans le dossier de la demande
// (« Mes demandes » / « Demandes reçues »).
// Tout passe par l'adresse (le bouton « retour » du navigateur fonctionne) :
// - /messages                         -> PRO : la liste de ses discussions ;
//                                        CLIENT : la discussion la plus récente
//                                        (sans aucun message : le dernier chat ouvert) ;
// - /messages?liste=1                 -> la liste de mes discussions (une ligne par personne) ;
// - /messages?avec=2&nom=…            -> la discussion avec cette personne ;
//     &demande=20                     -> … en parlant de cette demande (« À propos de ») ;
//     &texte=…                        -> … avec un message déjà écrit dans la barre ;
// - /messages?demande=20              -> la discussion avec l'autre personne de la demande 20
//                                        (bouton « Discuter avec… », notifications).
@Component({
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, BarreSaisie, BulleMessage],
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
  // Le lien vers les dossiers : la page des demandes, selon qui regarde
  readonly pageDemandes = this.estPro ? '/demandes-recues' : '/mes-demandes';

  // true : la liste de mes discussions (?liste=1) ; false : une discussion seule
  readonly modeListe = signal(false);

  readonly conversations = signal<Conversation[]>([]);
  readonly ouverte = signal<Ouverte | null>(null);
  readonly messages = signal<Message[]>([]);

  // Les demandes entre moi et cette personne (pour « À propos de »), la plus récente d'abord
  readonly demandesCommunes = signal<Demande[]>([]);
  // De quoi je parle quand j'écris : une demande (son id) ou null (question générale)
  readonly sujet = signal<number | null>(null);
  readonly sujetDemande = computed(
    () => this.demandesCommunes().find((d) => d.id === this.sujet()) ?? null,
  );
  // true : le sujet est déjà décidé (par l'adresse, par le dernier message ou par la personne) ;
  // le rafraîchissement automatique ne le change plus
  private sujetFixe = false;

  // Les messages avec leur étiquette : on ne la montre que quand le sujet change
  readonly lignesInverses = computed<Ligne[]>(() => {
    let precedent: number | null | undefined = undefined;
    const lignes = this.messages().map((m) => {
      const change = m.demandeId !== precedent;
      precedent = m.demandeId;
      return {
        message: m,
        etiquette: change
          ? m.demandeId !== null
            ? `📋 ${m.demandeTitre ?? 'Demande n° ' + m.demandeId}`
            : '💬 Question générale'
          : null,
      };
    });
    // Affichés dans une colonne inversée : la discussion reste collée en bas, comme WhatsApp
    return lignes.reverse();
  });

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  // Pendant qu'on cherche une discussion à ouvrir : pas de page « vide » qui clignote
  readonly rechercheChat = signal(false);
  // La barre du bas (champ + micro), pour la vider quand un texte est parti
  private readonly barre = viewChild(BarreSaisie);
  // ?texte=… : un message déjà écrit à mettre dans la barre du bas (ex. après « Réserver »)
  readonly brouillon = signal('');

  constructor() {
    // À chaque changement d'adresse (clic sur un lien, bouton « retour »…), on affiche
    // ce qu'elle demande. (La page n'est pas recréée quand seul le « ?… » change.)
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const avec = Number(params.get('avec')) || null;
        const demande = Number(params.get('demande')) || null;
        this.brouillon.set(params.get('texte') ?? '');
        // Le pro (plusieurs clients) arrive toujours sur la liste de ses discussions ;
        // le client, lui, arrive directement dans sa discussion la plus récente
        const menuSeul = avec === null && demande === null;
        this.modeListe.set(params.get('liste') !== null || (this.estPro && menuSeul));

        if (this.modeListe()) {
          this.ouverte.set(null);
          this.chargerConversations(false);
        } else if (avec !== null) {
          this.chargerConversations(false);
          this.ouvrir(
            { interlocuteurId: avec, interlocuteurNom: params.get('nom') ?? '' },
            demande,
          );
        } else if (demande !== null) {
          // ?demande=20 seul : on retrouve l'autre personne, puis on ouvre SA discussion
          this.allerVersDemande(demande, params.get('texte'));
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
        const o = this.ouverte();
        if (o !== null) this.chargerMessages(o);
      });
  }

  // ===== La liste de mes discussions =====

  // Cliquer une discussion l'ouvre seule (son adresse change)
  choisir(c: Conversation) {
    void this.router.navigate(['/messages'], {
      queryParams: { avec: c.interlocuteurId, nom: c.interlocuteurNom },
    });
  }

  // ouvrirLaPremiere : à l'arrivée sur la page, on ouvre la discussion la plus récente
  chargerConversations(ouvrirLaPremiere: boolean) {
    this.api
      .conversations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.conversations.set(liste);
          if (ouvrirLaPremiere && this.ouverte() === null) {
            if (liste.length > 0) {
              this.ouvrir(liste[0], null);
            } else {
              // Aucun message encore : le dernier chat ouvert (même vide),
              // sinon la personne de la demande la plus récente
              this.ouvrirSansMessage();
            }
          }
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  private ouvrirSansMessage() {
    const derniere = this.lireDerniere();
    if (derniere) {
      this.ouvrir(derniere, null);
      return;
    }
    this.rechercheChat.set(true);
    this.mesDemandes()
      .pipe(finalize(() => this.rechercheChat.set(false)))
      .subscribe({
        next: (liste) => {
          const recente = [...liste].sort((a, b) =>
            b.dateCreation.localeCompare(a.dateCreation),
          )[0];
          if (recente && this.ouverte() === null) {
            this.ouvrir(this.autreDe(recente), recente.id);
          }
        },
      });
  }

  // ?demande=20 : on ouvre la discussion avec l'autre personne de cette demande
  private allerVersDemande(demandeId: number, texte: string | null) {
    this.rechercheChat.set(true);
    this.demandeApi
      .detail(demandeId)
      .pipe(finalize(() => this.rechercheChat.set(false)))
      .subscribe({
        next: (d) => {
          const autre = this.autreDe(d);
          const queryParams: Params = {
            avec: autre.interlocuteurId,
            nom: autre.interlocuteurNom,
            demande: d.id,
          };
          if (texte) queryParams['texte'] = texte;
          void this.router.navigate(['/messages'], { queryParams, replaceUrl: true });
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Une discussion =====

  ouvrir(o: Ouverte, demandeId: number | null) {
    this.garderDerniere(o);
    const memePersonne = this.ouverte()?.interlocuteurId === o.interlocuteurId;
    this.ouverte.set({ interlocuteurId: o.interlocuteurId, interlocuteurNom: o.interlocuteurNom });
    this.sujetFixe = demandeId !== null;
    this.error.set('');
    if (!memePersonne) {
      this.messages.set([]);
      this.demandesCommunes.set([]);
    }
    this.sujet.set(demandeId);
    this.chargerMessages(o);
    this.chargerDemandesCommunes(o);
  }

  // Ouvrir la discussion marque ses messages comme lus
  private chargerMessages(o: Ouverte) {
    this.api.avec(o.interlocuteurId).subscribe({
      next: (liste) => {
        if (this.ouverte()?.interlocuteurId !== o.interlocuteurId) return;
        this.messages.set(liste);
        // Sans sujet demandé : on continue sur le sujet du dernier message (une seule fois)
        if (!this.sujetFixe && liste.length > 0) {
          this.sujet.set(liste[liste.length - 1].demandeId);
          this.sujetFixe = true;
        }
        this.compteurs.rafraichir();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  private chargerDemandesCommunes(o: Ouverte) {
    this.mesDemandes().subscribe({
      next: (liste) => {
        if (this.ouverte()?.interlocuteurId !== o.interlocuteurId) return;
        this.demandesCommunes.set(
          liste
            .filter((d) => this.autreDe(d).interlocuteurId === o.interlocuteurId)
            .sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)),
        );
        // Le nom manquait dans l'adresse ? On le prend sur une demande
        if (!o.interlocuteurNom && this.demandesCommunes()[0]) {
          this.ouverte.set(this.autreDe(this.demandesCommunes()[0]));
        }
      },
    });
  }

  // La personne choisit elle-même le sujet (« À propos de »)
  choisirSujet(demandeId: number | null) {
    this.sujet.set(demandeId);
    this.sujetFixe = true;
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

  // Un message écrit (venant de la barre du bas), sur le sujet choisi
  envoyerTexte(texte: string) {
    const o = this.ouverte();
    if (o === null || this.busy()) return;
    const sujet = this.sujet();
    this.envoi(
      sujet !== null
        ? this.api.envoyerDansDemande(sujet, texte)
        : this.api.envoyer(o.interlocuteurId, texte),
      true,
    );
  }

  // Un message vocal (venant de la barre du bas), sur le sujet choisi
  envoyerVocal(vocal: Vocal) {
    const o = this.ouverte();
    if (o === null || this.busy()) return;
    const sujet = this.sujet();
    this.envoi(
      sujet !== null
        ? this.api.envoyerVocalDansDemande(sujet, vocal)
        : this.api.envoyerVocal(o.interlocuteurId, vocal),
      false,
    );
  }

  private envoi(requete: ReturnType<MessageApiService['envoyer']>, viderBarre: boolean) {
    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (message) => {
        this.messages.update((liste) => [...liste, message]);
        if (viderBarre) this.barre()?.vider();
        this.chargerConversations(false);
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  // ===== Petites aides =====

  // Les demandes de la personne connectée (client ou pro)
  private mesDemandes() {
    return this.estPro
      ? this.demandeApi.listerPourPro(this.moiId)
      : this.demandeApi.listerPourClient(this.moiId);
  }

  // L'autre personne d'une demande
  private autreDe(d: Demande): Ouverte {
    return this.estPro
      ? { interlocuteurId: d.clientId, interlocuteurNom: d.clientNom }
      : { interlocuteurId: d.professionnelId, interlocuteurNom: d.professionnelNom };
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

  // Le dernier chat ouvert est gardé dans le navigateur (un par utilisateur)
  private cleDerniere() {
    return 'teranga.derniere-discussion.' + this.moiId;
  }

  private garderDerniere(o: Ouverte) {
    try {
      localStorage.setItem(
        this.cleDerniere(),
        JSON.stringify({
          interlocuteurId: o.interlocuteurId,
          interlocuteurNom: o.interlocuteurNom,
        }),
      );
    } catch {
      /* navigateur sans stockage : pas grave */
    }
  }

  private lireDerniere(): Ouverte | null {
    try {
      const texte = localStorage.getItem(this.cleDerniere());
      return texte ? (JSON.parse(texte) as Ouverte) : null;
    } catch {
      return null;
    }
  }
}
