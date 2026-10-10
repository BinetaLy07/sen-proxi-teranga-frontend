// Les 4 familles qui rangent les catégories (backend : FamilleCategorie)
export type FamilleCategorie = 'MAISON' | 'BATIMENT' | 'EVENEMENTS' | 'REPARATIONS';

// Une catégorie de services (backend : CategorieResponse)
export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  icone: string | null; // un emoji, ex. "🔧" (null : on affiche la 1re lettre du nom)
  famille: FamilleCategorie | null; // null : rangée dans « Autres services »
}

// Ce que l'administrateur envoie pour créer ou modifier une catégorie (backend : CategorieRequest)
export interface CategorieSaisie {
  nom: string; // obligatoire, 100 caractères maximum
  description: string | null; // 500 caractères maximum
  icone?: string | null; // facultatif : un emoji
  famille?: FamilleCategorie | null; // facultatif
}
