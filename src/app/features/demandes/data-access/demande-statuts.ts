import { StatutDemande } from './demande.models';

// Le parcours normal d'une demande, dans l'ordre (la frise des 9 étapes)
export const PARCOURS: { statut: StatutDemande; libelle: string }[] = [
  { statut: 'CREEE', libelle: 'Envoyée' },
  { statut: 'ACCEPTEE', libelle: 'Acceptée' },
  { statut: 'DEVIS_ENVOYE', libelle: 'Devis' },
  { statut: 'DEVIS_ACCEPTE', libelle: 'Devis accepté' },
  { statut: 'PLANIFIEE', libelle: 'Planifiée' },
  { statut: 'EN_COURS', libelle: 'En cours' },
  { statut: 'TERMINEE', libelle: 'Terminée' },
  { statut: 'CONFIRMEE', libelle: 'Confirmée' },
  { statut: 'CLOTUREE', libelle: 'Clôturée' },
];

// Le texte et la couleur de l'étiquette de chaque statut
export const ETIQUETTES: Record<StatutDemande, { libelle: string; classes: string }> = {
  CREEE: { libelle: 'En attente de réponse', classes: 'bg-indigo-50 text-brand-500' },
  ACCEPTEE: { libelle: 'Acceptée', classes: 'bg-sky-50 text-sky-700' },
  DEVIS_ENVOYE: { libelle: 'Devis reçu', classes: 'bg-orange-50 text-orange-700' },
  DEVIS_ACCEPTE: { libelle: 'Devis accepté', classes: 'bg-sky-50 text-sky-700' },
  PLANIFIEE: { libelle: 'Rendez-vous fixé', classes: 'bg-sky-50 text-sky-700' },
  EN_COURS: { libelle: 'Travaux en cours', classes: 'bg-sky-50 text-sky-700' },
  TERMINEE: { libelle: 'Travaux terminés', classes: 'bg-amber-50 text-amber-800' },
  CONFIRMEE: { libelle: 'Confirmée', classes: 'bg-amber-50 text-amber-800' },
  CLOTUREE: { libelle: 'Clôturée', classes: 'bg-emerald-50 text-emerald-700' },
  REFUSEE: { libelle: 'Refusée', classes: 'bg-red-50 text-red-700' },
  ANNULEE: { libelle: 'Annulée', classes: 'bg-gray-100 text-gray-700' },
  EXPIREE: { libelle: 'Expirée', classes: 'bg-gray-100 text-gray-700' },
  EN_LITIGE: { libelle: 'En litige', classes: 'bg-red-50 text-red-700' },
};

// Côté professionnel, certains textes changent de point de vue :
// c'est le pro qui a ENVOYÉ le devis (le client, lui, l'a reçu)
export const ETIQUETTES_PRO: Record<StatutDemande, { libelle: string; classes: string }> = {
  ...ETIQUETTES,
  DEVIS_ENVOYE: { libelle: 'Devis envoyé', classes: 'bg-orange-50 text-orange-700' },
};

// Annulation possible seulement avant « En cours » (même règle que le backend)
export const STATUTS_ANNULABLES: StatutDemande[] = [
  'CREEE',
  'ACCEPTEE',
  'DEVIS_ENVOYE',
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
];
