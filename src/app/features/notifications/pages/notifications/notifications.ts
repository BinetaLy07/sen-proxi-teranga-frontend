import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiError } from '../../../../core/http/api-error';
import { CompteursService } from '../../data-access/compteurs.service';
import { LIBELLES_TYPES, NotificationRecue } from '../../data-access/notification.models';
import { NotificationApiService } from '../../data-access/notification-api.service';
import { destinationNotification } from '../../data-access/destination-notification';

// « Notifications » : la liste, la plus récente en haut. Un clic marque la notification
// comme lue et ouvre le bon écran (la demande, les messages ou le profil).
@Component({ imports: [DatePipe], templateUrl: './notifications.html' })
export class Notifications {
  private readonly api = inject(NotificationApiService);
  private readonly compteurs = inject(CompteursService);
  private readonly router = inject(Router);
  private readonly role = inject(AuthService).session()?.role;

  readonly libelles = LIBELLES_TYPES;
  readonly notifications = signal<NotificationRecue[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.charger();
  }

  private charger() {
    this.api
      .lister()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.notifications.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  ouvrir(n: NotificationRecue) {
    if (!n.lue) {
      this.api.marquerLue(n.id).subscribe({ next: () => this.compteurs.rafraichir() });
    }
    void this.router.navigate(...destinationNotification(n, this.role));
  }

  toutLu() {
    this.api.toutLu().subscribe({
      next: () => {
        this.notifications.update((liste) => liste.map((n) => ({ ...n, lue: true })));
        this.compteurs.rafraichir();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  aDesNonLues() {
    return this.notifications().some((n) => !n.lue);
  }
}
