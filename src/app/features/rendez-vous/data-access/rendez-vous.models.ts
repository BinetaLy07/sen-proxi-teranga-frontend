import { StatutDemande } from '../../demandes/data-access/demande.models';

// Les états d'une date de rendez-vous (backend : StatutRendezVous)
// PROPOSE : une date attend la réponse de l'autre · ACCEPTE : l'autre a accepté
// REFUSE : l'autre a proposé une autre date à la place · REPORTE : la date acceptée a été changée
export type StatutRendezVous = 'PROPOSE' | 'ACCEPTE' | 'REFUSE' | 'REPORTE';

// Qui a proposé la date : c'est l'AUTRE qui doit répondre
export type AuteurRendezVous = 'CLIENT' | 'PROFESSIONNEL';

// Un rendez-vous (backend : RendezVousResponse)
export interface RendezVous {
  id: number;
  dateHeure: string; // "2026-10-10T09:00:00"
  statut: StatutRendezVous;
  proposePar: AuteurRendezVous;
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
