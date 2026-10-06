// Une catégorie de services (backend : CategorieResponse)
export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}
