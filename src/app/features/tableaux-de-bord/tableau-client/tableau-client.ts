import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { MonCompteService } from '../../../core/auth/mon-compte.service';
import { apiError } from '../../../core/http/api-error';
import { Demande, StatutDemande } from '../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../demandes/data-access/demande-api.service';
import { ETIQUETTES } from '../../demandes/data-access/demande-statuts';
import { Devis } from '../../devis/data-access/devis.models';
import { DevisApiService } from '../../devis/data-access/devis-api.service';
import { RendezVous } from '../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../rendez-vous/data-access/rendez-vous-api.service';
import { aVenir, heure, jourMois } from '../dates';

// Une demande « en cours » : ni terminée pour de bon, ni sortie du parcours
const EN_COURS: StatutDemande[] = [
  'CREEE',
  'ACCEPTEE',
  'DEVIS_ENVOYE',
  'DEVIS_ACCEPTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
];
// Les demandes qui peuvent avoir un rendez-vous proposé ou accepté
const AVEC_RENDEZ_VOUS: StatutDemande[] = ['DEVIS_ACCEPTE', 'PLANIFIEE'];

// « Tableau de bord » du client : l'essentiel en un coup d'œil.
// Les chiffres sont calculés à partir de ses demandes (une seule liste chargée au départ).
@Component({ imports: [DatePipe, RouterLink], templateUrl: './tableau-client.html' })
export class TableauClient {
  private readonly demandeApi = inject(DemandeApiService);
  private readonly devisApi = inject(DevisApiService);
  private readonly rendezVousApi = inject(RendezVousApiService);
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly etiquettes = ETIQUETTES;
  readonly jourMois = jourMois;
  readonly heure = heure;

  readonly prenom = signal('');
  readonly demandes = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- Les 3 compteurs ----------
  readonly enCours = computed(
    () => this.demandes().filter((d) => EN_COURS.includes(d.statut)).length,
  );
  readonly devisAValider = computed(() =>
    this.demandes().filter((d) => d.statut === 'DEVIS_ENVOYE'),
  );
  readonly rendezVous = signal<RendezVous[]>([]); // à venir, du plus proche au plus lointain

  // Les 5 demandes les plus récentes (pour le tableau)
  readonly recentes = computed(() =>
    [...this.demandes()].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)).slice(0, 5),
  );

  // ---------- Le devis à valider (le plus ancien d'abord) ----------
  readonly devis = signal<Devis | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');

  constructor() {
    inject(MonCompteService)
      .consulter()
      .subscribe({ next: (compte) => this.prenom.set(compte.prenom) });
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.demandeApi
      .listerPourClient(this.clientId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.demandes.set(liste);
          this.chargerDevis();
          this.chargerRendezVous(liste);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  private chargerDevis() {
    const premiere = this.devisAValider()[0];
    this.devis.set(null);
    if (!premiere) return;
    this.devisApi.actuel(premiere.id).subscribe({ next: (devis) => this.devis.set(devis) });
  }

  // Un appel par demande concernée ; une demande sans rendez-vous répond 404 : on l'ignore
  private chargerRendezVous(liste: Demande[]) {
    const concernees = liste.filter((d) => AVEC_RENDEZ_VOUS.includes(d.statut));
    if (concernees.length === 0) {
      this.rendezVous.set([]);
      return;
    }
    forkJoin(
      concernees.map((d) => this.rendezVousApi.actuel(d.id).pipe(catchError(() => of(null)))),
    ).subscribe((resultats) =>
      this.rendezVous.set(
        resultats
          .filter((r): r is RendezVous => r !== null)
          .filter((r) => (r.statut === 'PROPOSE' || r.statut === 'ACCEPTE') && aVenir(r.dateHeure))
          .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)),
      ),
    );
  }

  // Accepter le devis directement d'ici (négocier ou refuser : dans « Mes demandes »)
  accepterDevis() {
    const devis = this.devis();
    if (!devis || this.busy()) return;
    if (
      !confirm(
        `Accepter le devis de ${devis.professionnelNom} (${this.montant(devis.montantTotal)}) ?`,
      )
    ) {
      return;
    }
    this.busy.set(true);
    this.devisApi
      .accepter(this.clientId, devis.demandeId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.message.set('Devis accepté : le professionnel va vous proposer un rendez-vous.');
          this.charger();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }
}
