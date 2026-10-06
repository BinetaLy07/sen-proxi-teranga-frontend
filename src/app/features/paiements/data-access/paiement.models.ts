import { StatutDemande } from '../../demandes/data-access/demande.models';

// Les moyens de paiement (backend : ModePaiement)
export type ModePaiement = 'ESPECES' | 'WAVE' | 'ORANGE_MONEY' | 'FREE_MONEY';

// DECLARE : le client dit avoir payé · CONFIRME : le pro confirme · CONTESTE : litige
export type StatutPaiement = 'DECLARE' | 'CONFIRME' | 'CONTESTE';

export const MODES_PAIEMENT: { valeur: ModePaiement; libelle: string }[] = [
  { valeur: 'WAVE', libelle: 'Wave' },
  { valeur: 'ORANGE_MONEY', libelle: 'Orange Money' },
  { valeur: 'FREE_MONEY', libelle: 'Free Money' },
  { valeur: 'ESPECES', libelle: 'Espèces' },
];

// Un paiement (backend : PaiementResponse)
export interface Paiement {
  id: number;
  montant: number;
  modePaiement: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  dateDeclaration: string;
  dateLimiteConfirmation: string | null;
  dateReponse: string | null;
  motifContestation: string | null;
  demandeId: number;
  statutDemande: StatutDemande;
  serviceTitre: string;
  clientId: number;
  clientNom: string;
  professionnelId: number;
  professionnelNom: string;
}
