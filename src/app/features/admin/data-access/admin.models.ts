import { Role } from '../../../core/auth/auth.models';
import { StatutDemande } from '../../demandes/data-access/demande.models';

// Les types reprennent les DTO Java de l'espace administrateur.

// Le contrôle du profil d'un pro (backend : StatutVerification)
export type StatutVerification = 'EN_ATTENTE' | 'CORRECTION_DEMANDEE' | 'VALIDE' | 'REFUSE';

// Backend : StatutCompte (un compte SUSPENDU ne peut plus se connecter)
export type StatutCompte = 'ACTIF' | 'SUSPENDU';

// Les deux décisions possibles pour régler un litige (backend : DecisionLitige)
export type DecisionLitige = 'PAIEMENT_RECU' | 'DOSSIER_ANNULE';

// Le texte et la couleur de l'étiquette de chaque statut de vérification
export const ETIQUETTES_VERIFICATION: Record<
  StatutVerification,
  { libelle: string; classes: string }
> = {
  EN_ATTENTE: {
    libelle: 'En attente de vérification',
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  CORRECTION_DEMANDEE: {
    libelle: 'Correction demandée',
    classes: 'border-orange-200 bg-orange-50 text-orange-800',
  },
  VALIDE: { libelle: 'Validé', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  REFUSE: { libelle: 'Refusé', classes: 'border-red-200 bg-red-50 text-red-700' },
};

// Un professionnel vu par l'administrateur (backend : ProfessionnelAdminResponse)
export interface ProfessionnelAdmin {
  id: number;
  nomComplet: string;
  telephone: string;
  email: string;
  metier: string;
  experience: number | null;
  zones: string[];
  photoUrl: string | null; // protégée tant que le pro n'est pas validé
  statutVerification: StatutVerification;
  motifVerification: string | null; // le motif de la dernière correction ou du refus
  statutCompte: StatutCompte;
  dateInscription: string;
}

// Le tableau de bord (backend : StatistiquesResponse)
export interface Statistiques {
  nombreClients: number;
  nombreProfessionnels: number;
  professionnelsEnAttente: number;
  professionnelsValides: number;
  comptesSuspendus: number;
  nombreDemandes: number;
  demandesParStatut: Record<StatutDemande, number>; // ex : { "CREEE": 3, "ACCEPTEE": 1, … }
  demandesEnLitige: number;
  montantPaiementsConfirmes: number;
  nombreAvis: number;
}

// Un compte vu par l'administrateur (backend : UtilisateurResponse)
export interface CompteUtilisateur {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  role: Role;
  statutCompte: StatutCompte;
  statutVerification: StatutVerification | null; // seulement pour un pro
  dateInscription: string;
}
