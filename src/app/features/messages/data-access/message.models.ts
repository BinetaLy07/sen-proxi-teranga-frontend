// Un message (backend : MessageResponse)
export interface Message {
  id: number;
  expediteurId: number;
  expediteurNom: string;
  destinataireId: number;
  destinataireNom: string;
  contenu: string; // pour un vocal : « Message vocal (0:12) »
  dateEnvoi: string;
  lu: boolean;
  demandeId: number | null; // la demande dont on parle (null : question générale)
  type: 'TEXTE' | 'AUDIO'; // écrit ou vocal (comme WhatsApp)
  audioDuree: number | null; // durée du vocal en secondes (null pour un texte)
  // Supprimé par l'expéditeur (dans les 24 h) : contenu = « Ce message a été supprimé »
  // (l'administrateur, lui, reçoit le texte d'origine)
  supprime: boolean;
  dateSuppression: string | null;
  demandeTitre: string | null; // le titre de la demande dont on parle (null : question générale)
}

// Un message vocal prêt à partir : le son enregistré + sa durée en secondes
export interface Vocal {
  fichier: Blob;
  duree: number;
}

// Une conversation dans la liste (backend : ConversationResponse).
// UNE conversation par personne (toutes ses demandes et questions générales ensemble).
// demandeId / demandeTitre : la demande dont parle le dernier message.
export interface Conversation {
  interlocuteurId: number;
  interlocuteurNom: string;
  interlocuteurRole: 'CLIENT' | 'PROFESSIONNEL';
  demandeId: number | null; // null : question générale
  demandeTitre: string | null;
  dernierMessage: string;
  dateDernierMessage: string;
  dernierMessageEnvoyeParMoi: boolean;
  nombreNonLus: number;
}
