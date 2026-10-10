import { Component, computed, inject } from '@angular/core';
import { BienvenueService } from './bienvenue.service';

// Les couleurs des confettis (la couleur de la plateforme en premier)
const COULEURS = ['#465fff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

// La fenêtre de fête, affichée UNE SEULE FOIS : à la 1re connexion juste après l'inscription.
// Confettis qui tombent + coche verte qui se dessine + « Dalal ak diam sur Sen Proxi Teranga ! ».
// Elle reste ouverte jusqu'à ce que la personne clique sur « Continuer »
// (ou appuie sur la touche Échap du clavier).
// Tout est fait en CSS (pas de bibliothèque à installer).
@Component({
  selector: 'app-fenetre-bienvenue',
  templateUrl: './fenetre-bienvenue.html',
  styleUrl: './fenetre-bienvenue.css',
  host: { '(document:keydown.escape)': 'fermer()' },
})
export class FenetreBienvenue {
  private readonly service = inject(BienvenueService);
  readonly bienvenue = this.service.aAfficher;

  // Une phrase adaptée à chacun
  readonly phrase = computed(() => {
    switch (this.bienvenue()?.role) {
      case 'PROFESSIONNEL':
        return "Complétez votre profil (photo, services, réalisations) : il sera visible par les clients dès que l'administrateur l'aura validé.";
      case 'ADMINISTRATEUR':
        return 'Des professionnels attendent peut-être votre validation.';
      default:
        return 'Trouvez un professionnel près de chez vous en quelques clics.';
    }
  });

  // 70 confettis placés au hasard (position, couleur, vitesse, forme)
  readonly confettis = Array.from({ length: 70 }, (_, i) => ({
    gauche: Math.random() * 100,
    couleur: COULEURS[i % COULEURS.length],
    duree: 1.8 + Math.random() * 1.8,
    delai: Math.random() * 0.9,
    rond: i % 3 === 0,
  }));

  fermer() {
    this.service.fermer();
  }
}
