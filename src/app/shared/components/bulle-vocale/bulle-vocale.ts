import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { MessageApiService } from '../../../features/messages/data-access/message-api.service';

// Un message vocal dans une bulle, comme WhatsApp : ▶ / ⏸, des petites barres qui se
// colorent pendant l'écoute, et la durée.
// Le son n'est téléchargé qu'au premier clic sur ▶ (pas de téléchargement inutile).
// <app-bulle-vocale [messageId]="m.id" [duree]="m.audioDuree" [moi]="true" />
@Component({
  selector: 'app-bulle-vocale',
  templateUrl: './bulle-vocale.html',
})
export class BulleVocale {
  private readonly api = inject(MessageApiService);

  readonly messageId = input.required<number>();
  readonly duree = input<number | null>(null);
  // true : bulle bleue (mon message) ; false : bulle grise (message reçu)
  readonly moi = input(false);

  readonly enLecture = signal(false);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly position = signal(0); // secondes déjà écoutées

  private lecteur: HTMLAudioElement | null = null;
  private adresse: string | null = null;

  // 28 barres de hauteurs variées (toujours les mêmes pour un même message)
  readonly barres = computed(() => {
    let graine = this.messageId() * 9301 + 49297;
    return Array.from({ length: 28 }, () => {
      graine = (graine * 9301 + 49297) % 233280;
      return 6 + Math.round((graine / 233280) * 18);
    });
  });

  // Combien de barres sont déjà « écoutées » (colorées)
  readonly barresEcoutees = computed(() => {
    const total = this.duree() ?? 0;
    if (total <= 0) return 0;
    return Math.round((this.position() / total) * this.barres().length);
  });

  // Pendant l'écoute : le temps écoulé. Sinon : la durée totale.
  readonly temps = computed(() =>
    this.formater(this.enLecture() || this.position() > 0 ? this.position() : (this.duree() ?? 0)),
  );

  constructor() {
    // Quand la bulle disparaît : on arrête le son et on libère la mémoire
    inject(DestroyRef).onDestroy(() => {
      this.lecteur?.pause();
      if (this.adresse) URL.revokeObjectURL(this.adresse);
    });
  }

  basculer() {
    if (this.lecteur) {
      if (this.lecteur.paused) {
        void this.lecteur.play();
      } else {
        this.lecteur.pause();
      }
      return;
    }
    // Premier clic : on télécharge le son, puis on le lance
    this.chargement.set(true);
    this.erreur.set(false);
    this.api.vocal(this.messageId()).subscribe({
      next: (blob) => {
        this.chargement.set(false);
        this.adresse = URL.createObjectURL(blob);
        const lecteur = new Audio(this.adresse);
        lecteur.ontimeupdate = () => this.position.set(lecteur.currentTime);
        lecteur.onplay = () => this.enLecture.set(true);
        lecteur.onpause = () => this.enLecture.set(false);
        lecteur.onended = () => {
          this.enLecture.set(false);
          this.position.set(0);
        };
        this.lecteur = lecteur;
        void lecteur.play();
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  // 75 -> "1:15"
  private formater(secondes: number) {
    const s = Math.floor(secondes);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
