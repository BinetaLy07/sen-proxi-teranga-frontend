import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

// Page provisoire : la place est prête dans le menu,
// l'écran sera construit dans une prochaine étape.
// Le titre vient de la route (data: { titre: '...' }).
@Component({
  imports: [RouterLink],
  template: `
    <p class="eyebrow">BIENTÔT DISPONIBLE</p>
    <h1 class="page-title">{{ titre }}</h1>
    <p class="page-description">
      Cet écran est en cours de construction. Le backend est déjà prêt : il ne reste qu'à
      brancher l'interface.
    </p>
    <a routerLink="/espace" class="text-link mt-6 inline-block">Retour à mon espace</a>
  `,
})
export class AVenir {
  readonly titre: string = inject(ActivatedRoute).snapshot.data['titre'] ?? 'Page à venir';
}