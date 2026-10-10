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
