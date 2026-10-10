import { Categorie, FamilleCategorie } from './categorie.models';

// Les 4 familles de « Trouver un pro », dans l'ordre d'affichage,
// avec leur icône et leurs couleurs (classes Tailwind).
export interface InfosFamille {
  libelle: string;
  icone: string;
  titre: string; // couleur du titre de la famille
  fond: string; // fond clair (icônes, tuile choisie)
  bordure: string; // bordure de la tuile choisie
}

export const FAMILLES: Record<FamilleCategorie, InfosFamille> = {
  MAISON: {
    libelle: 'Maison & famille',
    icone: '🏠',
    titre: 'text-green-700',
    fond: 'bg-green-50',
    bordure: 'border-green-600',
  },
  BATIMENT: {
    libelle: 'Bâtiment & travaux',
    icone: '🧱',
    titre: 'text-brand-500',
    fond: 'bg-indigo-50',
    bordure: 'border-brand-500',
  },
  EVENEMENTS: {
    libelle: 'Événements & fêtes',
    icone: '🎉',
    titre: 'text-purple-700',
    fond: 'bg-purple-50',
    bordure: 'border-purple-600',
  },
  REPARATIONS: {
    libelle: 'Réparations & services',
    icone: '🛠️',
    titre: 'text-orange-700',
    fond: 'bg-orange-50',
    bordure: 'border-orange-600',
  },
};

// Les catégories sans famille (ajoutées par l'administrateur) vont ici
export const AUTRES: InfosFamille = {
  libelle: 'Autres services',
  icone: '✨',
  titre: 'text-gray-700',
  fond: 'bg-gray-100',
  bordure: 'border-gray-500',
};

const ORDRE: FamilleCategorie[] = ['MAISON', 'BATIMENT', 'EVENEMENTS', 'REPARATIONS'];

export interface GroupeFamille {
  cle: FamilleCategorie | 'AUTRES';
  infos: InfosFamille;
  categories: Categorie[];
}

// Range les catégories par famille (dans l'ordre), les familles vides ne sont pas montrées
export function regrouperParFamille(categories: Categorie[]): GroupeFamille[] {
  const groupes: GroupeFamille[] = ORDRE.map((cle) => ({
    cle,
    infos: FAMILLES[cle],
    categories: categories.filter((c) => c.famille === cle),
  }));
  groupes.push({
    cle: 'AUTRES',
    infos: AUTRES,
    categories: categories.filter((c) => !c.famille),
  });
  return groupes.filter((g) => g.categories.length > 0);
}

// L'icône d'une catégorie, ou sa 1re lettre si elle n'en a pas
export function iconeDe(c: Categorie): string {
  return c.icone || c.nom.charAt(0).toUpperCase();
}

// Les couleurs de la famille d'une catégorie
export function infosFamilleDe(c: Categorie): InfosFamille {
  return c.famille ? FAMILLES[c.famille] : AUTRES;
}
