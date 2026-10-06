import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// Affiche une image servie par le backend en envoyant le badge de connexion.
// Utile quand l'image n'est pas publique (ex : le profil d'un pro pas encore validé).
// <app-image-protegee [url]="'/api/professionnels/2/photo'" alt="…" classes="…" />
@Component({
  selector: 'app-image-protegee',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="alt()" [class]="classes()" />
    } @else {
      <span [class]="classes() + ' block bg-gray-100'" aria-hidden="true"></span>
    }
  `,
})
export class ImageProtegee {
  private readonly http = inject(HttpClient);

  readonly url = input.required<string>();
  readonly alt = input('');
  readonly classes = input('');
  readonly src = signal<string | null>(null);

  constructor() {
    effect(() => {
      const url = this.url();
      untracked(() => this.charger(url));
    });
    inject(DestroyRef).onDestroy(() => this.liberer());
  }

  private charger(url: string) {
    this.liberer();
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => this.src.set(URL.createObjectURL(blob)),
    });
  }

  private liberer() {
    const actuelle = this.src();
    if (actuelle) URL.revokeObjectURL(actuelle);
    this.src.set(null);
  }
}
