import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { Demande, StatutDemande } from '../../../demandes/data-access/demande.models';
import { ETIQUETTES, PARCOURS } from '../../../demandes/data-access/demande-statuts';
import { ProfessionnelAdmin, Statistiques } from '../../data-access/admin.models';
import { AdminApiService } from '../../data-access/admin-api.service';

// Les demandes sorties du parcours normal (affichées en petites étiquettes)
const SORTIES: StatutDemande[] = ['REFUSEE', 'ANNULEE', 'EXPIREE', 'EN_LITIGE'];

// « Tableau de bord » : la plateforme en un coup d'œil pour l'administrateur.
// Trois appels au backend en même temps : statistiques, profils à vérifier, litiges.
@Component({ imports: [DatePipe, RouterLink], templateUrl: './tableau-de-bord.html' })
export class TableauDeBord {
  private readonly adminApi = inject(AdminApiService);

  readonly stats = signal<Statistiques | null>(null);
  readonly aVerifier = signal<ProfessionnelAdmin[]>([]);
  readonly litiges = signal<Demande[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // Les barres « Demandes en cours, par étape » (sans « Clôturée » : c'est fini)
  readonly etapes = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const lignes = PARCOURS.filter((p) => p.statut !== 'CLOTUREE').map((p) => ({
      statut: p.statut,
      libelle: p.libelle,
      nombre: s.demandesParStatut[p.statut] ?? 0,
    }));
    // La plus longue barre = l'étape qui a le plus de demandes (100 %)
    const max = Math.max(1, ...lignes.map((l) => l.nombre));
    return lignes.map((l) => ({ ...l, largeur: Math.round((l.nombre * 100) / max) }));
  });

  readonly totalEnCours = computed(() => this.etapes().reduce((total, l) => total + l.nombre, 0));

  readonly sorties = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return SORTIES.map((statut) => ({
      statut,
      libelle: ETIQUETTES[statut].libelle,
      classes: ETIQUETTES[statut].classes,
      nombre: s.demandesParStatut[statut] ?? 0,
    }));
  });

  constructor() {
    // forkJoin : attend que les 3 réponses soient arrivées, puis les donne ensemble
    forkJoin({
      stats: this.adminApi.statistiques(),
      pros: this.adminApi.professionnels('EN_ATTENTE'),
      litiges: this.adminApi.litiges(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ stats, pros, litiges }) => {
          this.stats.set(stats);
          this.aVerifier.set(pros);
          this.litiges.set(litiges);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Petites aides pour l'affichage =====

  montant(valeur: number) {
    return valeur.toLocaleString('fr-FR') + ' F';
  }

  // "Ibrahima Sarr" -> "IS"
  initiales(nomComplet: string) {
    return nomComplet
      .split(' ')
      .filter((mot) => mot.length > 0)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  // "1 profil" / "3 profils"
  pluriel(nombre: number, mot: string) {
    return nombre + ' ' + mot + (nombre > 1 ? 's' : '');
  }
}
