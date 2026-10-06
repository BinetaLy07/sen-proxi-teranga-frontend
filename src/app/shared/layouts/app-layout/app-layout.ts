import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, interval, merge, startWith } from 'rxjs';
import { Role } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CompteursService } from '../../../features/notifications/data-access/compteurs.service';

interface LienMenu {
  libelle: string;
  chemin: string;
  // Pour afficher le petit chiffre rouge à côté du lien
  compteur?: 'messages' | 'notifications';
}

// Le menu de chaque rôle
const MENUS: Record<Role, LienMenu[]> = {
  CLIENT: [
    { libelle: 'Trouver un pro', chemin: '/recherche' },
    { libelle: 'Mes demandes', chemin: '/mes-demandes' },
    { libelle: 'Messages', chemin: '/messages', compteur: 'messages' },
    { libelle: 'Notifications', chemin: '/notifications', compteur: 'notifications' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
  PROFESSIONNEL: [
    { libelle: 'Demandes reçues', chemin: '/demandes-recues' },
    { libelle: 'Mes services', chemin: '/mes-services' },
    { libelle: 'Mon profil', chemin: '/mon-profil' },
    { libelle: 'Messages', chemin: '/messages', compteur: 'messages' },
    { libelle: 'Notifications', chemin: '/notifications', compteur: 'notifications' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
  ADMINISTRATEUR: [
    { libelle: 'Tableau de bord', chemin: '/admin' },
    { libelle: 'Professionnels', chemin: '/admin/professionnels' },
    { libelle: 'Litiges', chemin: '/admin/litiges' },
    { libelle: 'Mon compte', chemin: '/espace' },
  ],
};

const LIBELLES_ROLES: Record<Role, string> = {
  CLIENT: 'Client',
  PROFESSIONNEL: 'Professionnel',
  ADMINISTRATEUR: 'Administrateur',
};

// La mise en page de tous les écrans "connecté" : en-tête, menu selon le rôle, contenu
@Component({
  selector: 'app-app-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
})
export class AppLayout {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly compteurs = inject(CompteursService);

  // computed : se recalcule tout seul si la session change
  readonly liens = computed(() => {
    const role = this.auth.session()?.role;
    return role ? MENUS[role] : [];
  });

  readonly libelleRole = computed(() => {
    const role = this.auth.session()?.role;
    return role ? LIBELLES_ROLES[role] : '';
  });

  constructor() {
    // Les compteurs sont mis à jour : tout de suite, à chaque changement de page,
    // et toutes les 30 secondes
    merge(interval(30000), this.router.events.pipe(filter((e) => e instanceof NavigationEnd)))
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.compteurs.rafraichir());
  }

  nombre(lien: LienMenu) {
    if (lien.compteur === 'messages') return this.compteurs.messagesNonLus();
    if (lien.compteur === 'notifications') return this.compteurs.notificationsNonLues();
    return 0;
  }

  deconnecter() {
    // Même en cas d'erreur réseau, on revient à la connexion (la session locale est effacée)
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/connexion']),
      error: () => void this.router.navigate(['/connexion']),
    });
  }
}
