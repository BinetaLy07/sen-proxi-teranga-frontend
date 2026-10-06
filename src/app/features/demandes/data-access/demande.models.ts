import { TypeTarif } from '../../professionnels/data-access/professionnel.models';

// Le cycle de vie d'une demande (backend : StatutDemande)
export type StatutDemande =
  | 'CREEE'
  | 'ACCEPTEE'
  | 'DEVIS_ENVOYE'
  | 'DEVIS_ACCEPTE'
  | 'PLANIFIEE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'CONFIRMEE'
  | 'CLOTUREE'
  | 'REFUSEE'
  | 'ANNULEE'
  | 'EXPIREE'
  | 'EN_LITIGE';

// Une demande (backend : DemandeResponse)
export interface Demande {
  id: number;
  description: string;
  adresse: string;
  dateSouhaitee: string; // "2026-10-07"
  urgente: boolean;
  statut: StatutDemande;
  dateCreation: string;
  dateExpiration: string | null;
  motifRefus: string | null;
  motifAnnulation: string | null;
  resolutionLitige: string | null;
  visiteDemandee: boolean;
  fraisVisite: number | null; // null = pas de visite, 0 = gratuite
  clientId: number;
  clientNom: string;
  clientTelephone: string;
  professionnelId: number;
  professionnelNom: string;
  serviceId: number;
  serviceTitre: string;
  typeTarif: TypeTarif;
  montant: number | null;
  zoneId: number | null;
  zoneNom: string | null;
}

// Ce qu'on envoie pour créer une demande (backend : DemandeRequest)
export interface CreerDemande {
  serviceId: number;
  description: string;
  adresse: string;
  dateSouhaitee: string; // format AAAA-MM-JJ
  urgente: boolean;
  visiteDemandee: boolean;
  zoneId: number | null;
}

// Une photo ou une vidéo jointe (backend : MediaResponse)
export interface Media {
  id: number;
  type: 'IMAGE' | 'VIDEO';
  nomOriginal: string;
  contentType: string;
  taille: number;
  dateEnvoi: string;
  demandeId: number;
  url: string; // protégé : à charger avec HttpClient (voir le guide de l'encadreur)
}
