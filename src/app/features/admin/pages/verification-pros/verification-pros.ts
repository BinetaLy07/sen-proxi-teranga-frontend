import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { ImageProtegee } from '../../../../shared/components/image-protegee/image-protegee';
import { CompteursService } from '../../../notifications/data-access/compteurs.service';
import {
  ProfilProfessionnel,
  ServicePro,
} from '../../../professionnels/data-access/professionnel.models';
import { ProfessionnelApiService } from '../../../professionnels/data-access/professionnel-api.service';
import {
  ETIQUETTES_VERIFICATION,
  ProfessionnelAdmin,
  StatutVerification,
} from '../../data-access/admin.models';
import { AdminApiService } from '../../data-access/admin-api.service';

// Les boutons de filtre, dans l'ordre de la maquette
const FILTRES: { statut: StatutVerification; libelle: string }[] = [
  { statut: 'EN_ATTENTE', libelle: 'En attente' },
  { statut: 'CORRECTION_DEMANDEE', libelle: 'Correction demandée' },
  { statut: 'VALIDE', libelle: 'Validés' },
  { statut: 'REFUSE', libelle: 'Refusés' },
];

// « Professionnels » : l'administrateur vérifie les nouveaux profils.
// À gauche la liste (filtrée par statut), à droite le profil choisi et la décision.
// On peut arriver ici avec ?id=5 (bouton « Examiner » du tableau de bord).
@Component({
  imports: [DatePipe, ReactiveFormsModule, ImageProtegee],
  templateUrl: './verification-pros.html',
})
export class VerificationPros {
  private readonly adminApi = inject(AdminApiService);
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly compteurs = inject(CompteursService);

  readonly filtresDisponibles = FILTRES;
  readonly etiquettes = ETIQUETTES_VERIFICATION;

  // ---------- La liste ----------
  // On charge TOUS les pros une seule fois, puis on filtre ici (pour les compteurs des boutons)
  readonly pros = signal<ProfessionnelAdmin[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filtre = signal<StatutVerification>('EN_ATTENTE');

  readonly compteursFiltres = computed(() => {
    const nombres: Record<StatutVerification, number> = {
      EN_ATTENTE: 0,
      CORRECTION_DEMANDEE: 0,
      VALIDE: 0,
      REFUSE: 0,
    };
    for (const p of this.pros()) nombres[p.statutVerification]++;
    return nombres;
  });

  readonly filtres = computed(() =>
    this.pros().filter((p) => p.statutVerification === this.filtre()),
  );

  // ---------- Le pro choisi ----------
  readonly selectionId = signal<number | null>(null);
  readonly selection = computed(() => this.pros().find((p) => p.id === this.selectionId()) ?? null);
  // Le profil complet (description, services, réalisations) : un 2e appel au backend
  readonly profil = signal<ProfilProfessionnel | null>(null);
  readonly profilIndisponible = signal(false);

  // ---------- La décision ----------
  // Les points à contrôler : une aide pour l'admin, rien n'est envoyé au backend
  readonly points = inject(FormBuilder).nonNullable.group({
    photo: false,
    description: false,
    realisations: false,
    telephone: false,
  });
  readonly motif = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(500),
  });
  readonly motifManquant = signal(false);
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly actionSuccess = signal('');

  constructor() {
    const idVoulu = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('id')) || null;
    this.charger(idVoulu);
  }

  // ===== Chargement =====

  charger(idVoulu: number | null) {
    this.adminApi
      .professionnels()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => {
          this.pros.set(liste);
          // Le pro demandé (sinon le premier de la liste « En attente »)
          const voulu = liste.find((p) => p.id === idVoulu);
          if (voulu) {
            this.filtre.set(voulu.statutVerification);
            this.choisir(voulu.id);
          } else if (this.filtres().length > 0) {
            this.choisir(this.filtres()[0].id);
          }
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  changerFiltre(statut: StatutVerification) {
    this.filtre.set(statut);
    // On ouvre le premier de la nouvelle liste (ou rien si elle est vide)
    const premier = this.filtres()[0];
    if (premier) {
      this.choisir(premier.id);
    } else {
      this.selectionId.set(null);
    }
  }

  choisir(id: number) {
    this.selectionId.set(id);
    this.profil.set(null);
    this.profilIndisponible.set(false);
    this.points.reset();
    this.motif.reset();
    this.motifManquant.set(false);
    this.actionError.set('');
    this.actionSuccess.set('');
    // L'admin a le droit de lire le profil complet, même s'il n'est pas encore validé
    this.professionnelApi.monProfil(id).subscribe({
      next: (profil) => {
        if (this.selectionId() === id) this.profil.set(profil);
      },
      error: () => this.profilIndisponible.set(true),
    });
  }

  // ===== Les décisions =====

  valider() {
    const p = this.selection();
    if (!p) return;
    this.executer(this.adminApi.valider(p.id), 'Profil validé : le professionnel est prévenu.');
  }

  demanderCorrection() {
    const p = this.selection();
    const motif = this.motifObligatoire();
    if (!p || motif === null) return;
    this.executer(
      this.adminApi.demanderCorrection(p.id, motif),
      'Correction demandée : le professionnel est prévenu.',
    );
  }

  refuser() {
    const p = this.selection();
    const motif = this.motifObligatoire();
    if (!p || motif === null) return;
    this.executer(
      this.adminApi.refuser(p.id, motif),
      'Profil refusé : le professionnel est prévenu.',
    );
  }

  // Suspendre (le pro est déconnecté, il ne peut plus se connecter) ou réactiver
  changerStatutCompte() {
    const p = this.selection();
    if (!p || this.busy()) return;
    const suspendre = p.statutCompte === 'ACTIF';
    const question = suspendre
      ? `Suspendre le compte de ${p.nomComplet} ? Il sera déconnecté et ne pourra plus se connecter.`
      : `Réactiver le compte de ${p.nomComplet} ?`;
    if (!confirm(question)) return;

    this.busy.set(true);
    this.actionError.set('');
    this.adminApi
      .changerStatutCompte(p.id, suspendre ? 'SUSPENDU' : 'ACTIF')
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (compte) => {
          this.mettreAJour({ ...p, statutCompte: compte.statutCompte });
          this.actionSuccess.set(suspendre ? 'Compte suspendu.' : 'Compte réactivé.');
        },
        error: (error) => this.actionError.set(apiError(error)),
      });
  }

  // Pour une correction ou un refus, le motif est obligatoire (le pro le lira)
  private motifObligatoire(): string | null {
    const motif = this.motif.value.trim();
    this.motifManquant.set(motif.length === 0);
    if (motif.length === 0 || this.motif.invalid) return null;
    return motif;
  }

  private executer(requete: Observable<ProfessionnelAdmin>, succes: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (pro) => {
        // Le backend renvoie le pro à jour : on le remplace dans la liste
        this.mettreAJour(pro);
        this.motif.reset();
        this.actionSuccess.set(succes);
        this.compteurs.rafraichir(); // le chiffre rouge du menu
      },
      error: (error) => this.actionError.set(apiError(error)),
    });
  }

  private mettreAJour(pro: ProfessionnelAdmin) {
    this.pros.update((liste) => liste.map((p) => (p.id === pro.id ? pro : p)));
  }

  // ===== Petites aides pour l'affichage =====

  initiales(nomComplet: string) {
    return nomComplet
      .split(' ')
      .filter((mot) => mot.length > 0)
      .slice(0, 2)
      .map((mot) => mot[0].toUpperCase())
      .join('');
  }

  // "Salle de bain, WC" -> ["Salle de bain", "WC"]
  competences(texte: string | null) {
    return (texte ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }

  tarif(service: ServicePro) {
    const montant = service.montant != null ? service.montant.toLocaleString('fr-FR') + ' F' : '';
    if (service.typeTarif === 'FIXE') return montant + ' · prix fixe';
    if (service.typeTarif === 'A_PARTIR_DE') return 'À partir de ' + montant;
    return 'Sur devis';
  }
}
