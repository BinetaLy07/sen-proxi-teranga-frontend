import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { Media } from '../../data-access/demande.models';
import { DemandeApiService } from '../../data-access/demande-api.service';

// Une photo ou vidéo prête à afficher : l'url "blob:" est créée dans le navigateur
interface MediaAffiche {
  media: Media;
  url: string;
}

// Les photos / vidéos jointes à une demande.
// Les fichiers sont protégés : on les télécharge avec le badge (HttpClient),
// puis on crée une adresse locale avec URL.createObjectURL (règle du guide de l'encadreur).
@Component({
  selector: 'app-photos-demande',
  templateUrl: './photos-demande.html',
})
export class PhotosDemande {
  private readonly api = inject(DemandeApiService);

  readonly demandeId = input.required<number>();
  readonly fichiers = signal<MediaAffiche[]>([]);

  constructor() {
    effect(() => {
      const id = this.demandeId();
      untracked(() => this.charger(id));
    });
    // Quand le bloc disparaît, on libère la mémoire des adresses "blob:"
    inject(DestroyRef).onDestroy(() => this.liberer());
  }

  private charger(demandeId: number) {
    this.liberer();
    this.api.listerMedias(demandeId).subscribe({
      next: (medias) => {
        for (const media of medias) {
          this.api.fichierMedia(media.url).subscribe({
            next: (blob) =>
              this.fichiers.update((liste) => [
                ...liste,
                { media, url: URL.createObjectURL(blob) },
              ]),
          });
        }
      },
    });
  }

  private liberer() {
    for (const f of this.fichiers()) {
      URL.revokeObjectURL(f.url);
    }
    this.fichiers.set([]);
  }
}
