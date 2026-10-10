import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { MonCompte, MonCompteService } from '../../../core/auth/mon-compte.service';
import { apiError } from '../../../core/http/api-error';
import { ImageProtegee } from '../../../shared/components/image-protegee/image-protegee';
import { ETIQUETTES_VERIFICATION } from '../../admin/data-access/admin.models';
import { Demande } from '../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../demandes/data-access/demande-api.service';
import { ETIQUETTES_PRO, parcoursPro } from '../../demandes/data-access/demande-statuts';
import {
  FILTRES_PRO,
  regrouperDemandes,
  rendezVousAVenir,
  travauxTermines,
} from '../../demandes/data-access/filtres-demandes';
import { ProfilProfessionnel } from '../../professionnels/data-access/professionnel.models';
import { ProfessionnelApiService } from '../../professionnels/data-access/professionnel-api.service';
import { RendezVous } from '../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../rendez-vous/data-access/rendez-vous-api.service';
import { heure, jourMois } from '../dates';
import { STYLES_TABLEAU } from '../styles-tableau';

// « Tableau de bord » du professionnel, dans le même style que celui du client :
// - 4 cartes de couleur cliquables : elles ouvrent « Demandes reçues » filtrée
//   (?filtre=nouvelles, ?filtre=devis, ?filtre=rdv, ?filtre=termines) ;
// - ses nouvelles demandes (bouton « Répondre ») et son agenda ;
// - « Mes clients » : une ligne par client, un clic déplie ses demandes ;
// - ses réalisations.
// Le « Bonsoir » est dans la barre du haut (plus en double ici).
@Component({
  imports: [DatePipe, RouterLink, ImageProtegee],
  templateUrl: './tableau-pro.html',
  styles: [STYLES_TABLEAU],
})
export class TableauPro {
  private readonly demandeApi = inject(DemandeApiService);
  private readonly rendezVousApi = inject(RendezVousApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly etiquettesVerification = ETIQUETTES_VERIFICATION;
  readonly etiquettes = ETIQUETTES_PRO;
  readonly parcours = parcoursPro;
  readonly filtres = FILTRES_PRO;
  readonly jourMois = jourMois;
  readonly heure = heure;

  readonly profil = signal<ProfilProfessionnel | null>(null);
  readonly compte = signal<MonCompte | null>(null);
  readonly demandes = signal<Demande[]>([]);
  readonly agenda = signal<RendezVous[]>([]); // à venir, du plus proche au plus lointain
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- Les 4 cartes ----------
  readonly nouvelles = computed(() => this.demandes().filter((d) => d.statut === 'CREEE'));
  readonly devisEnAttente = computed(
    () => this.demandes().filter((d) => d.statut === 'DEVIS_ENVOYE').length,
  );
  readonly termines = computed(() => travauxTermines(this.demandes()).length);

  // ---------- Mes clients ----------
  readonly clients = computed(() => regrouperDemandes(this.demandes(), 'client'));
  // Le client dont les demandes sont dépliées (un seul à la fois)
  readonly clientDeplie = signal<number | null>(null);

  constructor() {
    inject(ProfessionnelApiService)
      .monProfil(this.proId)
      .subscribe({ next: (p) => this.profil.set(p) });
    inject(MonCompteService)
      .consulter()
      .subscribe({ next: (c) => this.compte.set(c) });

    this.demandeApi
      .listerPourPro(this.proId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.demandes.set(liste);
          rendezVousAVenir(this.rendezVousApi, liste).subscribe((rdv) => this.agenda.set(rdv));
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  deplier(clientId: number) {
    this.clientDeplie.update((id) => (id === clientId ? null : clientId));
  }

  // "Awa Diop" -> "AD"
  initiales(nom: string) {
    return nom
      .split(' ')
      .filter((mot) => mot)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }
}
