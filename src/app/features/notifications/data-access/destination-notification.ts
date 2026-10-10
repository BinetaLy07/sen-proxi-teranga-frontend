import { Role } from '../../../core/auth/auth.models';
import { NotificationRecue } from './notification.models';

// Où aller quand on clique sur une notification ? (dépend du type et du rôle)
// Sert à la page « Notifications » et à la petite fenêtre de la cloche.
export function destinationNotification(
  n: NotificationRecue,
  role: Role | undefined,
): [string[], { queryParams?: Record<string, number> }] {
  // Un message : la page Messages, ouverte sur la bonne conversation
  // (celle de la demande, ou les questions générales)
  if (n.type === 'NOUVEAU_MESSAGE') {
    return n.demandeId
      ? [['/messages'], { queryParams: { demande: n.demandeId } }]
      : [['/messages'], {}];
  }
  if (n.type === 'PROFIL_VERIFIE') return [['/mon-profil'], {}];
  const page = role === 'PROFESSIONNEL' ? '/demandes-recues' : '/mes-demandes';
  return n.demandeId ? [[page], { queryParams: { demande: n.demandeId } }] : [[page], {}];
}
