import {
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, interval, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { Devis } from '../../../devis/data-access/devis.models';
import { DevisApiService } from '../../../devis/data-access/devis-api.service';
import { Message } from '../../../messages/data-access/message.models';
import { MessageApiService } from '../../../messages/data-access/message-api.service';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import { MODES_PAIEMENT, Paiement } from '../../../paiements/data-access/paiement.models';
import { PaiementApiService } from '../../../paiements/data-access/paiement-api.service';
import { AuteurRendezVous, RendezVous } from '../../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../../rendez-vous/data-access/rendez-vous-api.service';
import { Demande } from '../../data-access/demande.models';

// Une petite carte d'action, affichée au milieu des messages (option B2)
export interface CarteAction {
  icone: string;
  titre: string;
  detail: string;
  couleur: 'gris' | 'orange' | 'vert' | 'bleu' | 'rouge';
  lienDevis?: boolean; // affiche « Voir le devis → »
}

// Un élément de la discussion : un message écrit, ou une carte d'action automatique
type Element =
  | { sorte: 'message'; cle: string; date: string; message: Message }
  | { sorte: 'carte'; cle: string; date: string; carte: CarteAction };

// La couleur de la bordure gauche de chaque carte
const BORDURES: Record<CarteAction['couleur'], string> = {
  gris: 'border-l-gray-400',
  orange: 'border-l-amber-500',
  vert: 'border-l-emerald-500',
  bleu: 'border-l-brand-500',
  rouge: 'border-l-red-500',
};

// « Discussion » d'une demande, entre son client et son professionnel.
// On y voit les messages écrits ET, automatiquement, les actions faites avec
// les boutons (devis, rendez-vous, travaux, paiement) sous forme de petites cartes.
// L'administrateur peut la lire (lectureSeule) pour trancher un litige.
@Component({
  selector: 'app-discussion-demande',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './discussion-demande.html',
})
export class DiscussionDemande {
  private readonly messageApi = inject(MessageApiService);
  private readonly devisApi = inject(DevisApiService);
  private readonly rendezVousApi = inject(RendezVousApiService);
  private readonly paiementApi = inject(PaiementApiService);
  private readonly compteurs = inject(CompteursService);
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(AuthService).session();
  readonly moiId = this.session?.utilisateurId ?? 0;

  readonly demande = input.required<Demande>();
  readonly lectureSeule = input(false);

  readonly messages = signal<Message[]>([]);
  readonly devis = signal<Devis | null>(null);
  readonly rendezVous = signal<RendezVous[]>([]);
  readonly paiement = signal<Paiement | null>(null);
  readonly charge = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly bordures = BORDURES;

  readonly texte = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000)],
  });

  // Le nom de l'autre (à qui j'écris)
  readonly autreNom = computed(() =>
    this.session?.role === 'PROFESSIONNEL'
      ? this.demande().clientNom
      : this.demande().professionnelNom,
  );

  // Tous les éléments, du plus ancien au plus récent
  readonly elements = computed<Element[]>(() => {
    const liste: Element[] = [
      ...this.messages().map((m) => ({
        sorte: 'message' as const,
        cle: 'm' + m.id,
        date: m.dateEnvoi,
        message: m,
      })),
      ...this.cartes(),
    ];
    return liste.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  // Affichés dans une colonne inversée : la discussion reste collée en bas, comme WhatsApp
  readonly elementsInverses = computed(() => [...this.elements()].reverse());

  constructor() {
    // Chaque fois que la demande change (ou qu'une action la met à jour), on recharge tout
    effect(() => {
      const demande = this.demande();
      untracked(() => this.charger(demande.id));
    });

    // Toutes les 15 secondes, on regarde s'il y a de nouveaux messages
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.chargerMessages(this.demande().id));
  }

  private charger(demandeId: number) {
    this.charge.set(false);
    this.error.set('');
    // Le devis, les dates et le paiement peuvent ne pas exister encore (404) : ce n'est pas une erreur
    forkJoin({
      messages: this.messageApi.deLaDemande(demandeId).pipe(catchError(() => of([] as Message[]))),
      devis: this.devisApi.actuel(demandeId).pipe(catchError(() => of(null))),
      rendezVous: this.rendezVousApi
        .historique(demandeId)
        .pipe(catchError(() => of([] as RendezVous[]))),
      paiement: this.paiementApi.deDemande(demandeId).pipe(catchError(() => of(null))),
    }).subscribe((r) => {
      if (this.demande().id !== demandeId) return;
      this.messages.set(r.messages);
      this.devis.set(r.devis);
      this.rendezVous.set(r.rendezVous);
      this.paiement.set(r.paiement);
      this.charge.set(true);
      this.compteurs.rafraichir(); // ouvrir la discussion marque les messages comme lus
    });
  }

  private chargerMessages(demandeId: number) {
    this.messageApi.deLaDemande(demandeId).subscribe({
      next: (liste) => {
        if (this.demande().id !== demandeId) return;
        if (liste.length !== this.messages().length) this.compteurs.rafraichir();
        this.messages.set(liste);
      },
    });
  }

  // Appelé par (submit) : preventDefault() empêche le navigateur de recharger la page
  envoyer(event?: Event) {
    event?.preventDefault();
    this.texte.markAsTouched();
    if (this.texte.invalid || this.busy() || this.lectureSeule()) return;
    this.busy.set(true);
    this.error.set('');
    this.messageApi
      .envoyerDansDemande(this.demande().id, this.texte.value.trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (message) => {
          this.messages.update((liste) => [...liste, message]);
          this.texte.reset();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // « Voir le devis → » : on descend jusqu'au bloc du devis, sur la même page
  voirDevis() {
    this.document
      .getElementById('bloc-devis')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // =====================================================================
  //         Les cartes d'action (construites à partir des données)
  // =====================================================================

  private cartes(): Element[] {
    const d = this.demande();
    const cartes: Element[] = [
      {
        sorte: 'carte',
        cle: 'demande',
        date: d.dateCreation,
        carte: {
          icone: '📝',
          titre: 'Demande envoyée',
          detail: `Par ${this.nom('CLIENT')}`,
          couleur: 'gris',
        },
      },
    ];

    // ----- Le devis (sa dernière version) -----
    const v = this.devis();
    if (v) {
      const version = v.numeroVersion > 1 ? ` (version ${v.numeroVersion})` : '';
      const etats: Record<string, { detail: string; couleur: CarteAction['couleur'] }> = {
        ENVOYE: { detail: 'En attente de la réponse du client', couleur: 'orange' },
        ACCEPTE: { detail: `Accepté par ${this.nom('CLIENT')} ✓`, couleur: 'vert' },
        REFUSE: { detail: `Refusé par ${this.nom('CLIENT')}`, couleur: 'rouge' },
        REVISION_DEMANDEE: {
          detail: `Révision demandée${v.motifRevision ? ' : « ' + v.motifRevision + ' »' : ''}`,
          couleur: 'orange',
        },
        REMPLACE: { detail: 'Remplacé par une nouvelle version', couleur: 'gris' },
      };
      const etat = etats[v.statut];
      cartes.push({
        sorte: 'carte',
        cle: 'devis',
        date: v.dateEnvoi,
        carte: {
          icone: '📄',
          titre: `Devis de ${this.montant(v.montantTotal)}${version}`,
          detail: `Envoyé par ${this.nom('PROFESSIONNEL')} · ${etat.detail}`,
          couleur: etat.couleur,
          lienDevis: true,
        },
      });
    }

    // ----- Les dates de rendez-vous -----
    // Les dates remplacées (REFUSE) ne font pas de carte : on les compte dans la suivante
    let remplacees = 0;
    for (const r of this.rendezVous()) {
      if (r.statut === 'REFUSE') {
        remplacees++;
        continue;
      }
      const quand = this.dateLisible(r.dateHeure);
      const avant = remplacees > 0 ? ` · après ${remplacees} autre(s) proposition(s)` : '';
      remplacees = 0;
      if (r.statut === 'PROPOSE') {
        cartes.push(
          this.carteRdv(
            r,
            '📅',
            `Date proposée : ${quand}`,
            this.attenteRdv(r.proposePar) + avant,
            'orange',
          ),
        );
      } else if (r.statut === 'ACCEPTE') {
        cartes.push(
          this.carteRdv(
            r,
            '📅',
            `Rendez-vous : ${quand}`,
            `Proposé par ${this.nom(r.proposePar)}, accepté par ${this.nom(this.autre(r.proposePar))}${avant}`,
            'bleu',
          ),
        );
      } else {
        cartes.push(
          this.carteRdv(r, '↩️', `Rendez-vous du ${quand} reporté`, r.motif ?? '', 'gris'),
        );
      }

      // ----- Les travaux (enregistrés sur le rendez-vous accepté) -----
      if (r.dateDebutTravaux) {
        cartes.push({
          sorte: 'carte',
          cle: 'debut' + r.id,
          date: r.dateDebutTravaux,
          carte: {
            icone: '🔧',
            titre: 'Travaux commencés',
            detail: `Par ${this.nom('PROFESSIONNEL')}`,
            couleur: 'bleu',
          },
        });
      }
      if (r.dateFinTravaux) {
        cartes.push({
          sorte: 'carte',
          cle: 'fin' + r.id,
          date: r.dateFinTravaux,
          carte: {
            icone: '🏁',
            titre: 'Travaux terminés',
            detail: `Par ${this.nom('PROFESSIONNEL')}`,
            couleur: 'vert',
          },
        });
      }
    }

    // ----- Le paiement -----
    const p = this.paiement();
    if (p) {
      const mode = MODES_PAIEMENT.find((m) => m.valeur === p.modePaiement)?.libelle ?? '';
      const etats: Record<string, { detail: string; couleur: CarteAction['couleur'] }> = {
        DECLARE: { detail: 'En attente de la confirmation du professionnel', couleur: 'orange' },
        CONFIRME: { detail: 'Confirmé ✓', couleur: 'vert' },
        CONTESTE: {
          detail: `Contesté${p.motifContestation ? ' : « ' + p.motifContestation + ' »' : ''}`,
          couleur: 'rouge',
        },
      };
      const etat = etats[p.statut];
      cartes.push({
        sorte: 'carte',
        cle: 'paiement',
        date: p.dateDeclaration,
        carte: {
          icone: '💰',
          titre: `Paiement de ${this.montant(p.montant)}${mode ? ' (' + mode + ')' : ''}`,
          detail: `Déclaré par ${this.nom('CLIENT')} · ${etat.detail}`,
          couleur: etat.couleur,
        },
      });
    }
    return cartes;
  }

  private carteRdv(
    r: RendezVous,
    icone: string,
    titre: string,
    detail: string,
    couleur: CarteAction['couleur'],
  ): Element {
    return {
      sorte: 'carte',
      cle: 'rdv' + r.id,
      date: r.dateProposition,
      carte: { icone, titre, detail, couleur },
    };
  }

  // « Proposée par vous · en attente de bineta ly »
  private attenteRdv(auteur: AuteurRendezVous) {
    return `Par ${this.nom(auteur)} · en attente de la réponse de ${this.nom(this.autre(auteur))}`;
  }

  // « vous » si c'est moi, sinon le nom (l'administrateur voit toujours les noms)
  private nom(role: AuteurRendezVous) {
    if (this.session?.role === role) return 'vous';
    return role === 'CLIENT' ? this.demande().clientNom : this.demande().professionnelNom;
  }

  private autre(role: AuteurRendezVous): AuteurRendezVous {
    return role === 'CLIENT' ? 'PROFESSIONNEL' : 'CLIENT';
  }

  // "2026-10-10T15:00:00" -> "10/10/2026 à 15h00"
  private dateLisible(dateIso: string) {
    const d = new Date(dateIso);
    const deux = (n: number) => String(n).padStart(2, '0');
    return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${deux(d.getHours())}h${deux(d.getMinutes())}`;
  }

  private montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }
}
