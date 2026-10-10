import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { RendezVous } from '../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../rendez-vous/data-access/rendez-vous-api.service';
import { Demande, StatutDemande } from './demande.models';

// Les 3 cartes du tableau de bord client, et la liste filtrée qu'elles ouvrent
// (/mes-demandes?filtre=en-cours, ?filtre=devis, ?filtre=rdv).
// Le même calcul sert aux deux endroits : le chiffre de la carte = le nombre de lignes.
export type FiltreDemandes = 'en-cours' | 'devis' | 'rdv';

export const FILTRES: Record<
  FiltreDemandes,
  { libelle: string; icone: string; vide: string; chip: string; bordure: string }
> = {
  'en-cours': {
    libelle: 'Demandes en cours',
    icone: '📋',
    vide: "Aucune demande en cours pour l'instant.",
    chip: 'border-blue-200 bg-blue-50 text-blue-800',
    bordure: 'border-l-blue-500',
  },
  devis: {
    libelle: 'Devis à valider',
    icone: '📄',
    vide: 'Aucun devis à valider pour le moment.',
    chip: 'border-orange-200 bg-orange-50 text-orange-800',
    bordure: 'border-l-orange-500',
  },
  rdv: {
    libelle: 'Rendez-vous à venir',
    icone: '📅',
    vide: "Aucun rendez-vous n'est prévu pour le moment.",
    chip: 'border-green-200 bg-green-50 text-green-800',
    bordure: 'border-l-green-600',
  },
};

// Lit le paramètre de l'adresse : une valeur inconnue = pas de filtre
export function lireFiltre(valeur: string | null): FiltreDemandes | null {
  return valeur === 'en-cours' || valeur === 'devis' || valeur === 'rdv' ? valeur : null;
}

// Une demande « en cours » : ni terminée pour de bon, ni sortie du parcours
export const STATUTS_EN_COURS: StatutDemande[] = [
  'CREEE',
  'ACCEPTEE',
  'DEVIS_ENVOYE',
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
];

// Les demandes qui peuvent avoir un rendez-vous proposé ou accepté
const AVEC_RENDEZ_VOUS: StatutDemande[] = ['DEVIS_ACCEPTE', 'PLANIFIEE'];

export function demandesEnCours(liste: Demande[]) {
  return liste.filter((d) => STATUTS_EN_COURS.includes(d.statut));
}

export function devisAValider(liste: Demande[]) {
  return liste.filter((d) => d.statut === 'DEVIS_ENVOYE');
}

// La date est-elle aujourd'hui ou plus tard ?
function aVenir(dateIso: string) {
  const debutDuJour = new Date();
  debutDuJour.setHours(0, 0, 0, 0);
  return new Date(dateIso).getTime() >= debutDuJour.getTime();
}

// Les rendez-vous à venir (proposés ou acceptés), du plus proche au plus lointain.
// Un appel par demande concernée ; une demande sans rendez-vous répond 404 : on l'ignore.
export function rendezVousAVenir(
  api: RendezVousApiService,
  liste: Demande[],
): Observable<RendezVous[]> {
  const concernees = liste.filter((d) => AVEC_RENDEZ_VOUS.includes(d.statut));
  if (concernees.length === 0) return of([]);
  return forkJoin(concernees.map((d) => api.actuel(d.id).pipe(catchError(() => of(null))))).pipe(
    map((resultats) =>
      resultats
        .filter((r): r is RendezVous => r !== null)
        .filter((r) => (r.statut === 'PROPOSE' || r.statut === 'ACCEPTE') && aVenir(r.dateHeure))
        .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)),
    ),
  );
}

// ===================== Côté professionnel =====================
// Les 4 cartes du tableau de bord du pro, et la liste « Demandes reçues » filtrée
// qu'elles ouvrent (/demandes-recues?filtre=nouvelles, devis, rdv ou termines).
export type FiltrePro = 'nouvelles' | 'devis' | 'rdv' | 'termines';

export const FILTRES_PRO: Record<
  FiltrePro,
  { libelle: string; icone: string; vide: string; chip: string; bordure: string }
> = {
  nouvelles: {
    libelle: 'Nouvelles demandes',
    icone: '📥',
    vide: 'Aucune nouvelle demande pour le moment.',
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    bordure: 'border-l-indigo-500',
  },
  devis: {
    libelle: 'Devis en attente',
    icone: '📄',
    vide: 'Aucun devis en attente de réponse du client.',
    chip: 'border-orange-200 bg-orange-50 text-orange-800',
    bordure: 'border-l-orange-500',
  },
  rdv: {
    libelle: 'Rendez-vous à venir',
    icone: '📅',
    vide: "Aucun rendez-vous n'est prévu pour le moment.",
    chip: 'border-green-200 bg-green-50 text-green-800',
    bordure: 'border-l-green-600',
  },
  termines: {
    libelle: 'Travaux terminés',
    icone: '✅',
    vide: 'Aucun travail terminé pour le moment.',
    chip: 'border-purple-200 bg-purple-50 text-purple-800',
    bordure: 'border-l-purple-500',
  },
};

export function lireFiltrePro(valeur: string | null): FiltrePro | null {
  return valeur === 'nouvelles' || valeur === 'devis' || valeur === 'rdv' || valeur === 'termines'
    ? valeur
    : null;
}

// Les travaux finis (confirmés ou non par le client)
export const STATUTS_TRAVAUX_TERMINES: StatutDemande[] = ['TERMINEE', 'CONFIRMEE', 'CLOTUREE'];

export function travauxTermines(liste: Demande[]) {
  return liste.filter((d) => STATUTS_TRAVAUX_TERMINES.includes(d.statut));
}

// ===================== Regrouper par personne =====================
// « Mes demandes » du client (une ligne par pro) et « Mes clients » du pro (une ligne par client).
export type Etat = 'attente' | 'enCours' | 'cloturees' | 'arretees';

export interface Groupe {
  personneId: number;
  nom: string;
  demandes: Demande[]; // la plus récente d'abord
  etats: Record<Etat, number>;
}

// En attente : le pro n'a pas encore répondu. En cours : le travail avance.
// Clôturée : terminée et confirmée. Sans suite : refusée, annulée, expirée ou en litige.
export function etatDe(statut: StatutDemande): Etat {
  if (statut === 'CREEE') return 'attente';
  if (statut === 'CONFIRMEE' || statut === 'CLOTUREE') return 'cloturees';
  if (STATUTS_EN_COURS.includes(statut)) return 'enCours';
  return 'arretees';
}

// La personne la plus récente en haut
export function regrouperDemandes(liste: Demande[], par: 'professionnel' | 'client'): Groupe[] {
  const groupes = new Map<number, Groupe>();
  const parDate = [...liste].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation));
  for (const d of parDate) {
    const id = par === 'professionnel' ? d.professionnelId : d.clientId;
    let g = groupes.get(id);
    if (!g) {
      g = {
        personneId: id,
        nom: par === 'professionnel' ? d.professionnelNom : d.clientNom,
        demandes: [],
        etats: { attente: 0, enCours: 0, cloturees: 0, arretees: 0 },
      };
      groupes.set(id, g);
    }
    g.demandes.push(d);
    g.etats[etatDe(d.statut)]++;
  }
  return [...groupes.values()];
}
