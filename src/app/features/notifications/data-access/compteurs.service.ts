import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { MessageApiService } from '../../messages/data-access/message-api.service';
import { NotificationApiService } from './notification-api.service';

// Les petits chiffres rouges du menu (messages et notifications non lus).
// Partagé par tout le site : l'en-tête les affiche, les pages les mettent à jour.
@Injectable({ providedIn: 'root' })
export class CompteursService {
  private readonly auth = inject(AuthService);
  private readonly messageApi = inject(MessageApiService);
  private readonly notificationApi = inject(NotificationApiService);

  readonly messagesNonLus = signal(0);
  readonly notificationsNonLues = signal(0);

  rafraichir() {
    // L'administrateur n'a ni messages ni notifications
    const role = this.auth.session()?.role;
    if (role !== 'CLIENT' && role !== 'PROFESSIONNEL') return;
    this.messageApi.nombreNonLus().subscribe({ next: (n) => this.messagesNonLus.set(n) });
    this.notificationApi
      .nombreNonLues()
      .subscribe({ next: (n) => this.notificationsNonLues.set(n) });
  }
}
