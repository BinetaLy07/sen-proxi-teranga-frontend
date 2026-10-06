import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MonCompteService } from '../../../../core/auth/mon-compte.service';
import { apiError } from '../../../../core/http/api-error';
import { DemandeApiService } from '../../../demandes/data-access/demande-api.service';
import { FavoriApiService } from '../../../favoris/data-access/favori-api.service';
import { Zone } from '../../../zones/data-access/zone.models';
import { ZoneApiService } from '../../../zones/data-access/zone-api.service';
import { ProfilProfessionnel, ServicePro } from '../../data-access/professionnel.models';
import { ProfessionnelApiService } from '../../data-access/professionnel-api.service';

// Les règles du backend pour les fichiers joints
const MAX_FICHIERS = 5;
const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo
const FORMATS = ['image/jpeg', 'image/png', 'video/mp4'];

// Le profil d'un professionnel (vu par un client) + le formulaire « Faire une demande »
@Component({ imports: [DatePipe, ReactiveFormsModule, RouterLink], templateUrl: './profil.html' })
export class Profil {
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly demandeApi = inject(DemandeApiService);
  private readonly favoriApi = inject(FavoriApiService);
  private readonly zoneApi = inject(ZoneApiService);
  private readonly monCompteService = inject(MonCompteService);

  // L'id du pro vient de l'adresse : /professionnels/2
  private readonly professionnelId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  // L'id du client connecté vient de la session
  private readonly clientId = inject(AuthService).session()?.utilisateurId ?? 0;

  // ---------- Le profil ----------
  readonly profil = signal<ProfilProfessionnel | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly etoiles = [1, 2, 3, 4, 5];

  readonly competences = computed(() =>
    (this.profil()?.competences ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0),
  );

  // ---------- Les favoris ----------
  readonly favori = signal(false);
  readonly favoriBusy = signal(false);

  // ---------- Le formulaire de demande ----------
  readonly quartiers = signal<Zone[]>([]);
  readonly fichiers = signal<File[]>([]);
  readonly fichiersError = signal('');
  readonly busy = signal(false);
  readonly demandeError = signal('');
  readonly demandeSuccess = signal('');
  readonly aujourdhui = dateDuJour();

  readonly form = inject(FormBuilder).nonNullable.group({
    serviceId: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    adresse: ['', [Validators.required, Validators.maxLength(255)]],
    zoneId: [''],
    dateSouhaitee: [this.aujourdhui, Validators.required],
    urgente: [false],
    visiteDemandee: [false],
  });

  constructor() {
    this.chargerProfil();

    // Pour proposer les quartiers dans le formulaire
    this.zoneApi.lister().subscribe({
      next: (zones) => this.quartiers.set(zones.filter((z) => z.type === 'QUARTIER')),
      error: () => this.quartiers.set([]),
    });

    // Pré-remplir l'adresse et le quartier avec ceux du client (« Mon compte »)
    this.monCompteService.consulter().subscribe({
      next: (compte) => {
        if (compte.adresse) this.form.controls.adresse.setValue(compte.adresse);
        if (compte.zoneId) this.form.controls.zoneId.setValue(String(compte.zoneId));
      },
    });

    // Ce pro est-il déjà dans mes favoris ?
    this.favoriApi.lister(this.clientId).subscribe({
      next: (liste) =>
        this.favori.set(liste.some((f) => f.professionnelId === this.professionnelId)),
    });
  }

  chargerProfil() {
    this.loading.set(true);
    this.professionnelApi
      .profil(this.professionnelId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (profil) => {
          this.profil.set(profil);
          // S'il n'y a qu'un service, on le choisit directement
          if (profil.services.length === 1) {
            this.form.controls.serviceId.setValue(String(profil.services[0].id));
          }
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Favoris =====

  basculerFavori() {
    if (this.favoriBusy()) return;
    this.favoriBusy.set(true);
    // Retirer ou ajouter, selon l'état actuel (les deux réponses sont différentes : unknown)
    const action: Observable<unknown> = this.favori()
      ? this.favoriApi.retirer(this.clientId, this.professionnelId)
      : this.favoriApi.ajouter(this.clientId, this.professionnelId);
    action.pipe(finalize(() => this.favoriBusy.set(false))).subscribe({
      next: () => this.favori.set(!this.favori()),
      error: (error) => this.demandeError.set(apiError(error)),
    });
  }

  // ===== Fichiers joints (facultatifs) =====

  choisirFichiers(event: Event) {
    const input = event.target as HTMLInputElement;
    const choisis = Array.from(input.files ?? []);
    this.fichiersError.set('');
    if (choisis.length > MAX_FICHIERS) {
      this.fichiersError.set(`${MAX_FICHIERS} fichiers maximum.`);
    } else if (choisis.some((f) => !FORMATS.includes(f.type))) {
      this.fichiersError.set('Formats acceptés : JPG, PNG ou MP4.');
    } else if (choisis.some((f) => f.size > TAILLE_MAX)) {
      this.fichiersError.set('Chaque fichier doit faire 20 Mo maximum.');
    }
    if (this.fichiersError()) {
      input.value = '';
      this.fichiers.set([]);
      return;
    }
    this.fichiers.set(choisis);
  }

  // ===== Envoi de la demande =====

  invalid(name: 'serviceId' | 'description' | 'adresse' | 'dateSouhaitee') {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }

  envoyer() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.fichiersError()) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.demandeError.set('');
    this.demandeSuccess.set('');

    // 1. On crée la demande
    this.demandeApi
      .creer(this.clientId, {
        serviceId: Number(v.serviceId),
        description: v.description.trim(),
        adresse: v.adresse.trim(),
        dateSouhaitee: v.dateSouhaitee,
        urgente: v.urgente,
        visiteDemandee: v.visiteDemandee,
        zoneId: v.zoneId ? Number(v.zoneId) : null,
      })
      .subscribe({
        next: (demande) => {
          // 2. Puis, s'il y en a, on envoie les photos / vidéos
          if (this.fichiers().length === 0) {
            this.terminer(v.urgente);
            return;
          }
          this.demandeApi.ajouterMedias(this.clientId, demande.id, this.fichiers()).subscribe({
            next: () => this.terminer(v.urgente),
            error: (error) => {
              this.terminer(v.urgente);
              this.demandeError.set(
                'La demande est envoyée, mais les fichiers n’ont pas pu être ajoutés : ' +
                  apiError(error),
              );
            },
          });
        },
        error: (error) => {
          this.busy.set(false);
          this.demandeError.set(apiError(error));
        },
      });
  }

  private terminer(urgente: boolean) {
    this.busy.set(false);
    const prenom = this.profil()?.prenom ?? 'Le professionnel';
    this.demandeSuccess.set(
      `Demande envoyée ! ${prenom} a ${urgente ? '2 heures' : '48 heures'} pour vous répondre.`,
    );
    this.form.controls.description.reset();
    this.form.controls.urgente.reset();
    this.form.controls.visiteDemandee.reset();
    this.fichiers.set([]);
  }

  // ===== Petites aides pour l'affichage =====

  tarif(service: ServicePro) {
    const montant = service.montant != null ? service.montant.toLocaleString('fr-FR') + ' F' : '';
    if (service.typeTarif === 'FIXE') return montant + ' · prix fixe';
    if (service.typeTarif === 'A_PARTIR_DE') return 'À partir de ' + montant;
    return 'Sur devis';
  }

  initiales(prenom: string, nom: string) {
    return ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase();
  }

  note(valeur: number) {
    return valeur.toFixed(1).replace('.', ',');
  }

  taille(octets: number) {
    return (octets / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
  }
}

// La date du jour au format AAAA-MM-JJ (pour le champ date)
function dateDuJour() {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}
