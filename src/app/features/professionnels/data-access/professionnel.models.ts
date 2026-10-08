// Les types reprennent les DTO Java du backend.
// Les dates JSON arrivent en texte (ex : "2026-10-06T18:30:00").

export type TypeTarif = 'FIXE' | 'A_PARTIR_DE' | 'SUR_DEVIS';

// Une carte dans les résultats de recherche (backend : ProfessionnelResumeResponse)
export interface ProfessionnelResume {
  id: number;
  nomComplet: string;
  metier: string;
  description: string | null;
  experience: number | null;
  noteMoyenne: number;
  nombreAvis: number;
  photoUrl: string | null; // ex : "/api/professionnels/2/photo" (public)
  zones: string[];
}

// Un service proposé (backend : ServiceResponse)
export interface ServicePro {
  id: number;
  titre: string;
  description: string | null;
  typeTarif: TypeTarif;
  montant: number | null;
  actif: boolean;
  categorieId: number;
  categorieNom: string;
  professionnelId: number;
  professionnelNom: string;
}

// Un avis public (backend : AvisResponse)
export interface Avis {
  id: number;
  note: number;
  commentaire: string | null;
  dateAvis: string;
  reponse: string | null;
  dateReponse: string | null;
  demandeId: number;
  serviceTitre: string;
  clientNom: string; // abrégé, ex : "Awa D."
  professionnelId: number;
  professionnelNom: string;
}

// Une photo de la galerie (backend : RealisationResponse)
export interface Realisation {
  id: number;
  titre: string;
  description: string | null;
  dateAjout: string;
  url: string; // ex : "/api/realisations/1/fichier" (public)
}

// Le profil public complet (backend : ProfilProfessionnelResponse)
export interface ProfilProfessionnel {
  id: number;
  prenom: string;
  nom: string;
  metier: string;
  description: string | null;
  competences: string | null;
  experience: number | null;
  photoUrl: string | null;
  noteMoyenne: number;
  nombreAvis: number;
  membreDepuis: string;
  zones: string[];
  services: ServicePro[];
  avis: Avis[];
  realisations: Realisation[];
}

// Les filtres de la recherche (null = pas de filtre)
export interface FiltresRecherche {
  metier: string | null;
  categorieId: number | null;
  zoneId: number | null;
}

// Ce que le pro modifie dans son profil (backend : ModifierProfilRequest).
// Attention : le backend remplace TOUS ces champs, il faut donc renvoyer les valeurs actuelles.
export interface ModifierProfil {
  description: string | null;
  competences: string | null; // séparées par des virgules : "Fuites, Chauffe-eau"
  experience: number | null;
  whatsapp: string | null;
  alerteSmsActive: boolean;
}

// Les numéros d'un pro, pour les boutons « WhatsApp » et « Appeler » (backend : ContactProResponse)
export interface ContactPro {
  professionnelId: number;
  telephone: string;
  whatsapp: string | null; // null : le pro n'a pas donné de WhatsApp
}
