import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminApiService } from '../../admin/data-access/admin-api.service';
import { MessageApiService } from '../../messages/data-access/message-api.service';
import { NotificationApiService } from './notification-api.service';

// Les petits chiffres rouges du menu.
// Partagé par tout le site : l'en-tête les affiche, les pages les mettent à jour.
// - client et pro : messages et notifications non lus ;
// - administrateur : profils à vérifier et litiges à trancher.
@Injectable({ providedIn: 'root' })
export class CompteursService {
  private readonly auth = inject(AuthService);
  private readonly messageApi = inject(MessageApiService);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly adminApi = inject(AdminApiService);

  readonly messagesNonLus = signal(0);
  readonly notificationsNonLues = signal(0);
  readonly prosEnAttente = signal(0);
  readonly litigesOuverts = signal(0);

  rafraichir() {
    const role = this.auth.session()?.role;

    // L'administrateur n'a ni messages ni notifications : on lit ses statistiques
    if (role === 'ADMINISTRATEUR') {
      this.adminApi.statistiques().subscribe({
        next: (s) => {
          this.prosEnAttente.set(s.professionnelsEnAttente);
          this.litigesOuverts.set(s.demandesEnLitige);
        },
      });
      return;
    }

    if (role !== 'CLIENT' && role !== 'PROFESSIONNEL') return;
    this.messageApi.nombreNonLus().subscribe({ next: (n) => this.messagesNonLus.set(n) });
    this.notificationApi
      .nombreNonLues()
      .subscribe({ next: (n) => this.notificationsNonLues.set(n) });
  }
}
