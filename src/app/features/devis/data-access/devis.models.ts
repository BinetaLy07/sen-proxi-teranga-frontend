// Les états d'un devis (backend : StatutDevis)
export type StatutDevis = 'ENVOYE' | 'REVISION_DEMANDEE' | 'REMPLACE' | 'ACCEPTE' | 'REFUSE';

// Les 3 sortes de lignes (backend : TypeLigneDevis)
export type TypeLigneDevis = 'MAIN_OEUVRE' | 'MATERIEL' | 'DEPLACEMENT';

// Une ligne du devis, avec son montant calculé par le serveur (backend : LigneDevisResponse)
export interface LigneDevis {
  id: number;
  type: TypeLigneDevis;
  libelle: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
}

// Le devis complet (backend : DevisResponse)
export interface Devis {
  id: number;
  numeroVersion: number;
  statut: StatutDevis;
  montantTotal: number;
  motifRevision: string | null;
  motifRefus: string | null;
  dateEnvoi: string;
  demandeId: number;
  serviceTitre: string;
  clientId: number;
  clientNom: string;
  professionnelId: number;
  professionnelNom: string;
  lignes: LigneDevis[];
}
