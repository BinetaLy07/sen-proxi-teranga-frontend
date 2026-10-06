import { Component, computed, DOCUMENT, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Categorie } from '../categories/data-access/categorie.models';
import { CategorieApiService } from '../categories/data-access/categorie-api.service';
import { Zone } from '../zones/data-access/zone.models';
import { ZoneApiService } from '../zones/data-access/zone-api.service';

// Les 4 étapes de « Comment ça marche »
const ETAPES = [
  {
    titre: 'Cherchez',
    texte:
      'Filtrez par métier, catégorie et quartier. Seuls les professionnels vérifiés apparaissent.',
  },
  {
    titre: 'Décrivez votre besoin',
    texte:
      'Un texte suffit. Ajoutez des photos ou une vidéo, ou demandez au professionnel de passer voir.',
  },
  {
    titre: 'Recevez un devis',
    texte:
      "Main-d'œuvre, matériel, déplacement : tout est détaillé. Vous pouvez demander une révision.",
  },
  {
    titre: 'Rendez-vous, paiement, avis',
    texte:
      'Payez en espèces, Wave, Orange Money ou Free Money, puis donnez votre avis sur le travail.',
  },
];

// La page d'accueil publique (avant la connexion), d'après la maquette « Main ».
// Les catégories et les quartiers viennent du backend (adresses publiques).
@Component({ imports: [ReactiveFormsModule, RouterLink], templateUrl: './accueil.html' })
export class Accueil {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  readonly etapes = ETAPES;
  readonly annee = new Date().getFullYear();

  // Déjà connecté ? On affiche « Mon espace » au lieu de « Se connecter »
  readonly connecte = computed(() => this.auth.session() !== null);

  readonly categories = signal<Categorie[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly communes = computed(() => this.zones().filter((z) => z.type === 'COMMUNE'));
  readonly quartiers = computed(() => this.zones().filter((z) => z.type === 'QUARTIER'));

  // Le petit formulaire de recherche du haut de la page
  readonly form = inject(FormBuilder).nonNullable.group({
    metier: [''],
    zoneId: [''],
  });

  constructor() {
    inject(CategorieApiService)
      .lister()
      .subscribe({ next: (liste) => this.categories.set(liste) });
    inject(ZoneApiService)
      .lister()
      .subscribe({ next: (liste) => this.zones.set(liste) });
  }

  // On part vers « Trouver un pro » avec les filtres dans l'adresse :
  // /recherche?metier=Plombier&zoneId=3 (si on n'est pas connecté, on passe d'abord par la connexion)
  rechercher() {
    const v = this.form.getRawValue();
    void this.router.navigate(['/recherche'], {
      queryParams: { metier: v.metier.trim() || null, zoneId: v.zoneId || null },
    });
  }

  // Les liens du menu font défiler la page jusqu'à la section
  allerA(id: string) {
    this.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
