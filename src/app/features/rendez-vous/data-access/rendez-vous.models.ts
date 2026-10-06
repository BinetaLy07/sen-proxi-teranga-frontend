import { StatutDemande } from '../../demandes/data-access/demande.models';

// Les états d'un rendez-vous (backend : StatutRendezVous)
// PROPOSE : le pro a proposé une date · ACCEPTE : le client a accepté
// REFUSE : le client a refusé · REPORTE : la date acceptée a été changée
export type StatutRendezVous = 'PROPOSE' | 'ACCEPTE' | 'REFUSE' | 'REPORTE';

// Un rendez-vous (backend : RendezVousResponse)
export interface RendezVous {
  id: number;
  dateHeure: string; // "2026-10-10T09:00:00"
  statut: StatutRendezVous;
  motif: string | null; // raison du refus ou du report
  dateProposition: string;
  dateDebutTravaux: string | null;
  dateFinTravaux: string | null;
  demandeId: number;
  statutDemande: StatutDemande;
  serviceTitre: string;
  adresse: string;
  clientId: number;
  clientNom: string;
  clientTelephone: string;
  professionnelId: number;
  professionnelNom: string;
}
