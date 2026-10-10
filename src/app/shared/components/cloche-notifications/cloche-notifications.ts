import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CompteursService } from '../../../features/notifications/data-access/compteurs.service';
import { destinationNotification } from '../../../features/notifications/data-access/destination-notification';
import { NotificationRecue } from '../../../features/notifications/data-access/notification.models';
import { NotificationApiService } from '../../../features/notifications/data-access/notification-api.service';

// La cloche en haut à droite (remplace « Notifications » du menu de gauche).
// - pastille rouge avec le nombre de notifications non lues (pas de pastille = rien de nouveau) ;
// - un clic ouvre une petite fenêtre avec les 5 dernières ;
// - un clic sur l'une d'elles la marque comme lue et ouvre la bonne page.
@Component({
  selector: 'app-cloche-notifications',
  imports: [RouterLink],
  templateUrl: './cloche-notifications.html',
  // La cloche se balance doucement quand il y a du nouveau (pas si l'utilisateur
  // a demandé moins d'animations dans son téléphone ou son ordinateur)
  styles: `
    .cloche-bouge {
      transform-origin: 50% 2px;
      animation: balance 2.4s ease-in-out infinite;
    }
    @keyframes balance {
      0%,
      60%,
      100% {
        transform: rotate(0);
      }
      66% {
        transform: rotate(14deg);
      }
      74% {
        transform: rotate(-12deg);
      }
      82% {
        transform: rotate(8deg);
      }
      90% {
        transform: rotate(-4deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cloche-bouge {
        animation: none;
      }
    }
  `,
  host: {
    class: 'relative',
    '(document:click)': 'clicAilleurs($event)',
    '(document:keydown.escape)': 'ouverte.set(false)',
  },
})
export class ClocheNotifications {
  private readonly api = inject(NotificationApiService);
  private readonly router = inject(Router);
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly role = inject(AuthService).session()?.role;
  readonly compteurs = inject(CompteursService);

  readonly ouverte = signal(false);
  readonly notifications = signal<NotificationRecue[]>([]);
  readonly loading = signal(false);

  basculer() {
    const ouvrir = !this.ouverte();
    this.ouverte.set(ouvrir);
    if (ouvrir) this.charger();
  }

  private charger() {
    this.loading.set(true);
    this.api
      .lister()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (liste) => this.notifications.set(liste.slice(0, 5)) });
  }

  ouvrir(n: NotificationRecue) {
    this.ouverte.set(false);
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
    });
  }

  aDesNonLues() {
    return this.notifications().some((n) => !n.lue);
  }

  // « il y a 5 min », « il y a 2 h », « hier », sinon la date
  depuis(dateIso: string) {
    const minutes = Math.floor((Date.now() - new Date(dateIso).getTime()) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    if (heures < 48) return 'hier';
    return new Date(dateIso).toLocaleDateString('fr-FR');
  }

  // Un clic en dehors de la cloche et de sa fenêtre la referme
  clicAilleurs(event: MouseEvent) {
    if (this.ouverte() && !this.element.nativeElement.contains(event.target as Node)) {
      this.ouverte.set(false);
    }
  }
}
