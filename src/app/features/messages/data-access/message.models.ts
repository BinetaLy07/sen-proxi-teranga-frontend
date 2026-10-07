// Un message (backend : MessageResponse)
export interface Message {
  id: number;
  expediteurId: number;
  expediteurNom: string;
  destinataireId: number;
  destinataireNom: string;
  contenu: string;
  dateEnvoi: string;
  lu: boolean;
  demandeId: number | null; // la demande dont on parle (null : question générale)
}

// Une conversation dans la liste (backend : ConversationResponse).
// Avec la même personne : une conversation par demande, plus les « questions générales ».
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
