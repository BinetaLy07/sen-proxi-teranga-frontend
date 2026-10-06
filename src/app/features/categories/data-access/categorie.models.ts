// Une catégorie de services (backend : CategorieResponse)
export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

// Ce que l'administrateur envoie pour créer ou modifier une catégorie (backend : CategorieRequest)
export interface CategorieSaisie {
  nom: string; // obligatoire, 100 caractères maximum
  description: string | null; // 500 caractères maximum
}
