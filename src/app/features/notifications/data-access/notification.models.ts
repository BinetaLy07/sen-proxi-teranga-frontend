// Le type d'une notification (backend : TypeNotification)
export type TypeNotification =
  | 'NOUVELLE_DEMANDE'
  | 'DEMANDE_ACCEPTEE'
  | 'DEMANDE_REFUSEE'
  | 'DEMANDE_EXPIREE'
  | 'DEVIS_RECU'
  | 'RENDEZ_VOUS_PROPOSE'
  | 'RENDEZ_VOUS_ACCEPTE'
  | 'RENDEZ_VOUS_REPORTE'
  | 'PAIEMENT_DECLARE'
  | 'PAIEMENT_CONFIRME'
  | 'PROFIL_VERIFIE'
  | 'LITIGE_RESOLU'
  | 'NOUVEAU_MESSAGE';

// Une notification (backend : NotificationResponse)
export interface NotificationRecue {
  id: number;
  type: TypeNotification;
  titre: string;
  message: string;
  demandeId: number | null; // pour ouvrir directement la demande concernée
  lue: boolean;
  date: string;
}

// Le petit texte affiché devant chaque notification
export const LIBELLES_TYPES: Record<TypeNotification, string> = {
  NOUVELLE_DEMANDE: 'Demande',
  DEMANDE_ACCEPTEE: 'Demande',
  DEMANDE_REFUSEE: 'Demande',
  DEMANDE_EXPIREE: 'Demande',
  DEVIS_RECU: 'Devis',
  RENDEZ_VOUS_PROPOSE: 'Rendez-vous',
  RENDEZ_VOUS_ACCEPTE: 'Rendez-vous',
  RENDEZ_VOUS_REPORTE: 'Rendez-vous',
  PAIEMENT_DECLARE: 'Paiement',
  PAIEMENT_CONFIRME: 'Paiement',
  PROFIL_VERIFIE: 'Profil',
  LITIGE_RESOLU: 'Litige',
  NOUVEAU_MESSAGE: 'Message',
};
