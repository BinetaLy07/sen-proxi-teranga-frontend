import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, interval, merge, startWith } from 'rxjs';
import { ACCUEIL_ROLE } from '../../../core/auth/accueil-role';
import { Role } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CompteursService } from '../../../features/notifications/data-access/compteurs.service';

interface LienMenu {
  libelle: string;
  chemin: string;
  // Pour afficher le petit chiffre rouge à côté du lien
  compteur?: 'messages' | 'notifications' | 'pros' | 'litiges';
}

// Le menu de chaque rôle (dans la barre de gauche)
const MENUS: Record<Role, LienMenu[]> = {
  CLIENT: [
    { libelle: 'Tableau de bord', chemin: '/client' },
    { libelle: 'Trouver un pro', chemin: '/recherche' },
    { libelle: 'Mes demandes', chemin: '/mes-demandes' },
    { libelle: 'Mes favoris', chemin: '/favoris' },
    { libelle: 'Messages', chemin: '/messages', compteur: 'messages' },
    { libelle: 'Notifications', chemin: '/notifications', compteur: 'notifications' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
  PROFESSIONNEL: [
    { libelle: 'Tableau de bord', chemin: '/pro' },
    { libelle: 'Demandes reçues', chemin: '/demandes-recues' },
    { libelle: 'Mes services', chemin: '/mes-services' },
    { libelle: 'Mon profil', chemin: '/mon-profil' },
    { libelle: 'Messages', chemin: '/messages', compteur: 'messages' },
    { libelle: 'Notifications', chemin: '/notifications', compteur: 'notifications' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
  ADMINISTRATEUR: [
    { libelle: 'Tableau de bord', chemin: '/admin' },
    { libelle: 'Professionnels', chemin: '/admin/professionnels', compteur: 'pros' },
    { libelle: 'Litiges', chemin: '/admin/litiges', compteur: 'litiges' },
    { libelle: 'Comptes', chemin: '/admin/comptes' },
    { libelle: 'Catégories', chemin: '/admin/categories' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
};

// Le petit titre sous le nom de la plateforme
const ESPACES: Record<Role, string> = {
  CLIENT: 'ESPACE CLIENT',
  PROFESSIONNEL: 'ESPACE PROFESSIONNEL',
  ADMINISTRATEUR: 'ADMINISTRATION',
};

// La mise en page de tous les écrans « connecté » :
// une barre de menu à gauche (selon le rôle) et le contenu à droite.
// Sur téléphone, la barre est cachée : le bouton « Menu » la fait glisser.
@Component({
  selector: 'app-app-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
})
export class AppLayout {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly compteurs = inject(CompteursService);

  // Le lien du menu est en surbrillance si le chemin est exactement le sien,
  // même avec des paramètres en plus (ex : /mes-demandes?demande=18)
  readonly optionsLienActif: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  };

  // Sur téléphone : la barre de menu est-elle ouverte ?
  readonly menuOuvert = signal(false);

  // computed : se recalcule tout seul si la session change
  readonly liens = computed(() => {
    const role = this.auth.session()?.role;
    return role ? MENUS[role] : [];
  });

  readonly espace = computed(() => {
    const role = this.auth.session()?.role;
    return role ? ESPACES[role] : '';
  });

  // Le logo ramène au tableau de bord du rôle
  readonly accueil = computed(() => {
    const role = this.auth.session()?.role;
    return role ? ACCUEIL_ROLE[role] : '/';
  });

  constructor() {
    const changementsDePage = this.router.events.pipe(filter((e) => e instanceof NavigationEnd));
    // Les compteurs sont mis à jour : tout de suite, à chaque changement de page,
    // et toutes les 30 secondes
    merge(interval(30000), changementsDePage)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.compteurs.rafraichir());
    // Sur téléphone, on referme le menu dès qu'on a choisi une page
    changementsDePage.pipe(takeUntilDestroyed()).subscribe(() => this.menuOuvert.set(false));
  }

  nombre(lien: LienMenu) {
    if (lien.compteur === 'messages') return this.compteurs.messagesNonLus();
    if (lien.compteur === 'notifications') return this.compteurs.notificationsNonLues();
    if (lien.compteur === 'pros') return this.compteurs.prosEnAttente();
    if (lien.compteur === 'litiges') return this.compteurs.litigesOuverts();
    return 0;
  }

  // Pour les lecteurs d'écran : « 3 non lus » ou « 2 à traiter »
  texteCompteur(lien: LienMenu) {
    return lien.compteur === 'pros' || lien.compteur === 'litiges' ? 'à traiter' : 'non lus';
  }

  deconnecter() {
    // Même en cas d'erreur réseau, on revient à la connexion (la session locale est effacée)
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/connexion']),
      error: () => void this.router.navigate(['/connexion']),
    });
  }
}
