// Un professionnel dans les favoris du client (backend : FavoriResponse)
export interface Favori {
  id: number;
  dateAjout: string;
  professionnelId: number;
  professionnelNom: string;
  metier: string;
  noteMoyenne: number;
  photo: string | null;
}
