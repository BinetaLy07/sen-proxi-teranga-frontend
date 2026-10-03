import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<main class="mx-auto max-w-2xl px-6 py-16">
    <a routerLink="/inscription" class="text-link">← Retour à l’inscription</a>
    <h1 class="page-title mt-8">Conditions d’utilisation</h1>
    <div class="notice">Version de travail à faire valider avant ouverture au public.</div>
    <div class="mt-8 space-y-5 leading-relaxed text-gray-600">
      <p>
        Sen Proxi Teranga met en relation clients et professionnels pour des services de proximité.
      </p>
      <p>
        Chaque utilisateur fournit des informations exactes, garde ses identifiants confidentiels et
        utilise la plateforme de manière respectueuse.
      </p>
      <p>
        Un administrateur peut suspendre un compte. Vous pouvez gérer et révoquer vos sessions
        depuis votre espace personnel.
      </p>
      <p>
        Les modalités de paiement, de règlement des litiges, de protection des données et les
        coordonnées de l’éditeur doivent être complétées et validées avant la mise en production.
      </p>
    </div>
  </main>`,
})
export class Terms {}
