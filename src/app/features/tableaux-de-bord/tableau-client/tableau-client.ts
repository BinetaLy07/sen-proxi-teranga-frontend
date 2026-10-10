import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { apiError } from '../../../core/http/api-error';
import { Demande, StatutDemande } from '../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../demandes/data-access/demande-api.service';
import { ETIQUETTES } from '../../demandes/data-access/demande-statuts';
import { Devis } from '../../devis/data-access/devis.models';
import { DevisApiService } from '../../devis/data-access/devis-api.service';
import { RendezVous } from '../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../rendez-vous/data-access/rendez-vous-api.service';
import {
  demandesEnCours,
  devisAValider,
  FILTRES,
  rendezVousAVenir,
  STATUTS_EN_COURS,
} from '../../demandes/data-access/filtres-demandes';
import {
  ContactPro,
  ProfilProfessionnel,
} from '../../professionnels/data-access/professionnel.models';
import { ProfessionnelApiService } from '../../professionnels/data-access/professionnel-api.service';

// Les 4 états affichés dans « Mes demandes » (regroupement par pro)
type Etat = 'attente' | 'enCours' | 'cloturees' | 'arretees';

interface GroupePro {
  professionnelId: number;
  nom: string;
  demandes: Demande[]; // la plus récente d'abord
  etats: Record<Etat, number>;
}

// En attente : le pro n'a pas encore répondu. En cours : le travail avance.
// Clôturée : terminée et payée. Arrêtée : refusée, annulée, expirée ou en litige.
function etatDe(statut: StatutDemande): Etat {
  if (statut === 'CREEE') return 'attente';
  if (statut === 'CONFIRMEE' || statut === 'CLOTUREE') return 'cloturees';
  if (STATUTS_EN_COURS.includes(statut)) return 'enCours';
  return 'arretees';
}

// « Tableau de bord » du client : l'essentiel en un coup d'œil.
// Les chiffres sont calculés à partir de ses demandes (une seule liste chargée au départ).
// Chaque carte de couleur est un lien : elle ouvre « Mes demandes » filtrée
// (?filtre=en-cours, ?filtre=devis ou ?filtre=rdv). Le « Bonsoir » est dans la barre du haut.
@Component({
  imports: [DatePipe, RouterLink],
  templateUrl: './tableau-client.html',
  styles: `
    /* Une carte de couleur : se soulève un peu au survol */
    .carte {
      display: block;
      border-radius: 1.25rem;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }
    .carte:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 24px -10px rgb(0 0 0 / 0.25);
    }
    .carte:hover .voir {
      text-decoration: underline;
    }
    .pastille-icone {
      display: flex;
      width: 2.25rem;
      height: 2.25rem;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: rgb(255 255 255 / 0.75);
    }
    .voir {
      display: block;
      margin-top: 1rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .bloc {
      border-radius: 1.25rem;
      border: 1px solid #e5e7eb;
      background: white;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    }
    .etat {
      border-radius: 9999px;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 0 1rem;
      text-align: center;
    }
    @media (prefers-reduced-motion: reduce) {
      .carte,
      .carte:hover {
        transition: none;
        transform: none;
      }
    }
  `,
})
export class TableauClient {
  private readonly demandeApi = inject(DemandeApiService);
  private readonly devisApi = inject(DevisApiService);
  private readonly rendezVousApi = inject(RendezVousApiService);
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly etiquettes = ETIQUETTES;
  readonly filtres = FILTRES;

  readonly demandes = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- Les 3 compteurs ----------
  readonly enCours = computed(() => demandesEnCours(this.demandes()).length);
  readonly devisAValider = computed(() => devisAValider(this.demandes()));
  readonly rendezVous = signal<RendezVous[]>([]); // à venir, du plus proche au plus lointain

  // ---------- « Mes demandes » regroupées par professionnel ----------
  // Une ligne par pro (le plus récent en haut), avec le nombre de demandes par état.
  // Un clic sur la ligne déplie ses demandes.
  readonly groupes = computed<GroupePro[]>(() => {
    const parPro = new Map<number, GroupePro>();
    const parDate = [...this.demandes()].sort((a, b) =>
      b.dateCreation.localeCompare(a.dateCreation),
    );
    for (const d of parDate) {
      let g = parPro.get(d.professionnelId);
      if (!g) {
        g = {
          professionnelId: d.professionnelId,
          nom: d.professionnelNom,
          demandes: [],
          etats: { attente: 0, enCours: 0, cloturees: 0, arretees: 0 },
        };
        parPro.set(d.professionnelId, g);
      }
      g.demandes.push(d);
      g.etats[etatDe(d.statut)]++;
    }
    return [...parPro.values()];
  });
  // Le pro dont les demandes sont dépliées (un seul à la fois)
  readonly proDeplie = signal<number | null>(null);

  deplier(professionnelId: number) {
    this.proDeplie.update((id) => (id === professionnelId ? null : professionnelId));
  }

  // ---------- Mon professionnel ----------
  // Le pro de la demande en cours la plus récente (sinon de la dernière demande)
  readonly demandeDuPro = computed(() => {
    const recentes = [...this.demandes()].sort((a, b) =>
      b.dateCreation.localeCompare(a.dateCreation),
    );
    return demandesEnCours(recentes)[0] ?? recentes[0] ?? null;
  });
  readonly pro = signal<ProfilProfessionnel | null>(null);
  readonly proIntrouvable = signal(false); // profil pas disponible : on montre juste le nom
  readonly contactPro = signal<ContactPro | null>(null); // son numéro (bouton « Contacter »)

  // ---------- Le devis à valider (le plus ancien d'abord) ----------
  readonly devis = signal<Devis | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');

  constructor() {
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.demandeApi
      .listerPourClient(this.clientId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.demandes.set(liste);
          this.chargerDevis();
          this.chargerRendezVous(liste);
          this.chargerPro();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  private chargerDevis() {
    const premiere = this.devisAValider()[0];
    this.devis.set(null);
    if (!premiere) return;
    this.devisApi.actuel(premiere.id).subscribe({ next: (devis) => this.devis.set(devis) });
  }

  // Le profil public du pro (photo, métier, étoiles…). En cas d'erreur, la carte reste vide.
  private chargerPro() {
    const demande = this.demandeDuPro();
    if (!demande) {
      this.pro.set(null);
      return;
    }
    if (this.pro()?.id === demande.professionnelId) return;
    this.professionnelApi.profil(demande.professionnelId).subscribe({
      next: (profil) => this.pro.set(profil),
      error: () => this.proIntrouvable.set(true),
    });
    // Son numéro : si on ne peut pas l'obtenir, pas de bouton « Contacter » (reste « Écrire »)
    this.professionnelApi.contact(demande.professionnelId).subscribe({
      next: (c) => this.contactPro.set(c),
      error: () => this.contactPro.set(null),
    });
  }

  // "771234567" -> "+221 77 123 45 67" (pour l'afficher)
  telephoneLisible(numero: string) {
    const n = numeroInternational(numero).slice(3);
    return `+221 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  }

  // Le lien qui lance l'appel sur le téléphone
  lienAppel(numero: string) {
    return 'tel:+' + numeroInternational(numero);
  }

  // "bineta ly" -> "BL" (le rond devant le nom du pro dans « Mes demandes »)
  initialesNom(nom: string) {
    return nom
      .split(' ')
      .filter((mot) => mot)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  // "Bineta" + "Ly" -> "BL" (quand le pro n'a pas de photo)
  initiales(p: ProfilProfessionnel) {
    return ((p.prenom[0] ?? '') + (p.nom[0] ?? '')).toUpperCase();
  }

  // 4.8 -> "4,8" (écriture française)
  note(valeur: number) {
    return valeur.toFixed(1).replace('.', ',');
  }

  private chargerRendezVous(liste: Demande[]) {
    rendezVousAVenir(this.rendezVousApi, liste).subscribe((liste) => this.rendezVous.set(liste));
  }

  // Accepter le devis directement d'ici (négocier ou refuser : dans « Mes demandes »)
  accepterDevis() {
    const devis = this.devis();
    if (!devis || this.busy()) return;
    if (
      !confirm(
        `Accepter le devis de ${devis.professionnelNom} (${this.montant(devis.montantTotal)}) ?`,
      )
    ) {
      return;
    }
    this.busy.set(true);
    this.devisApi
      .accepter(this.clientId, devis.demandeId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.message.set('Devis accepté : choisissez maintenant la date du rendez-vous.');
          this.charger();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }
}

// "77 123 45 67" ou "+221 77…" -> "221771234567" (le format attendu par tel:)
function numeroInternational(numero: string) {
  const chiffres = numero.replace(/\D/g, '');
  return chiffres.startsWith('221') ? chiffres : '221' + chiffres;
}
