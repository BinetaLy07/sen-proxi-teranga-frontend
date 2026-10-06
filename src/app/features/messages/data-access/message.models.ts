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
}

// Une conversation dans la liste (backend : ConversationResponse)
export interface Conversation {
  interlocuteurId: number;
  interlocuteurNom: string;
  interlocuteurRole: 'CLIENT' | 'PROFESSIONNEL';
  dernierMessage: string;
  dateDernierMessage: string;
  dernierMessageEnvoyeParMoi: boolean;
  nombreNonLus: number;
}
