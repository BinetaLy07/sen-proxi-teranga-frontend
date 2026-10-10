import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { MonCompte, MonCompteService } from '../../../core/auth/mon-compte.service';
import { apiError } from '../../../core/http/api-error';
import { ImageProtegee } from '../../../shared/components/image-protegee/image-protegee';
import { ETIQUETTES_VERIFICATION } from '../../admin/data-access/admin.models';
import { Demande, StatutDemande } from '../../demandes/data-access/demande.models';
import { DemandeApiService } from '../../demandes/data-access/demande-api.service';
import { ProfilProfessionnel } from '../../professionnels/data-access/professionnel.models';
import { ProfessionnelApiService } from '../../professionnels/data-access/professionnel-api.service';
import { RendezVous } from '../../rendez-vous/data-access/rendez-vous.models';
import { RendezVousApiService } from '../../rendez-vous/data-access/rendez-vous-api.service';
import { aVenir, heure, jourMois } from '../dates';
import { salutation } from '../../../shared/utils/salutation';

// Les demandes qui peuvent avoir un rendez-vous proposé ou accepté
const AVEC_RENDEZ_VOUS: StatutDemande[] = ['DEVIS_ACCEPTE', 'PLANIFIEE'];
// Les travaux finis (confirmés ou non par le client)
const TERMINES: StatutDemande[] = ['TERMINEE', 'CONFIRMEE', 'CLOTUREE'];

// « Tableau de bord » du professionnel : ses nouvelles demandes, son agenda, ses réalisations.
@Component({
  imports: [DatePipe, RouterLink, ImageProtegee],
  templateUrl: './tableau-pro.html',
})
export class TableauPro {
  // « Bonjour » le jour, « Bonsoir » à partir de 18 h
  readonly salutation = salutation();
  private readonly demandeApi = inject(DemandeApiService);
  private readonly rendezVousApi = inject(RendezVousApiService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;

  readonly etiquettesVerification = ETIQUETTES_VERIFICATION;
  readonly jourMois = jourMois;
  readonly heure = heure;

  readonly profil = signal<ProfilProfessionnel | null>(null);
  readonly compte = signal<MonCompte | null>(null);
  readonly demandes = signal<Demande[]>([]);
  readonly agenda = signal<RendezVous[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---------- Les 4 compteurs ----------
  readonly nouvelles = computed(() => this.demandes().filter((d) => d.statut === 'CREEE'));
  readonly devisEnAttente = computed(
    () => this.demandes().filter((d) => d.statut === 'DEVIS_ENVOYE').length,
  );
  readonly termines = computed(
    () => this.demandes().filter((d) => TERMINES.includes(d.statut)).length,
  );

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
          this.chargerAgenda(liste);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // Un appel par demande concernée ; une demande sans rendez-vous répond 404 : on l'ignore
  private chargerAgenda(liste: Demande[]) {
    const concernees = liste.filter((d) => AVEC_RENDEZ_VOUS.includes(d.statut));
    if (concernees.length === 0) return;
    forkJoin(
      concernees.map((d) => this.rendezVousApi.actuel(d.id).pipe(catchError(() => of(null)))),
    ).subscribe((resultats) =>
      this.agenda.set(
        resultats
          .filter((r): r is RendezVous => r !== null)
          .filter((r) => (r.statut === 'PROPOSE' || r.statut === 'ACCEPTE') && aVenir(r.dateHeure))
          .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)),
      ),
    );
  }
}
