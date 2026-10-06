import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MonCompte, MonCompteService } from '../../../../core/auth/mon-compte.service';
import { apiError } from '../../../../core/http/api-error';
import { ImageProtegee } from '../../../../shared/components/image-protegee/image-protegee';
import { ProfilProfessionnel } from '../../data-access/professionnel.models';
import { ProfessionnelApiService } from '../../data-access/professionnel-api.service';

const FORMATS_IMAGE = ['image/jpeg', 'image/png'];
const MAX_REALISATIONS = 10;

// « Mon profil » du professionnel : le statut de vérification, les informations
// (description, compétences, expérience, WhatsApp, alerte SMS), la photo et les réalisations.
@Component({
  imports: [DatePipe, ReactiveFormsModule, ImageProtegee],
  templateUrl: './mon-profil.html',
})
export class MonProfil {
  private readonly api = inject(ProfessionnelApiService);
  private readonly monCompteService = inject(MonCompteService);
  private readonly proId = inject(AuthService).session()?.utilisateurId ?? 0;
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly maxRealisations = MAX_REALISATIONS;
  readonly compte = signal<MonCompte | null>(null);
  readonly profil = signal<ProfilProfessionnel | null>(null);
  // Ajouté à l'adresse de la photo pour forcer son rechargement après un changement
  readonly versionPhoto = signal(Date.now());
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);

  // ---------- Les informations ----------
  readonly form = this.fb.group({
    description: ['', Validators.maxLength(2000)],
    competences: ['', Validators.maxLength(2000)],
    experience: [null as number | null, [Validators.min(0), Validators.max(60)]],
    whatsapp: ['', Validators.pattern(/^(\+221)?7[05678]\d{7}$/)],
    alerteSmsActive: [false],
  });

  // ---------- Nouvelle réalisation ----------
  readonly formRealisation = this.fb.group({
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(500)],
  });
  readonly fichierRealisation = signal<File | null>(null);

  constructor() {
    this.charger();
  }

  private charger() {
    // Les infos du compte : statut de vérification, WhatsApp, alerte SMS
    this.monCompteService.consulter().subscribe({
      next: (compte) => {
        this.compte.set(compte);
        this.form.patchValue({
          whatsapp: compte.whatsapp ?? '',
          alerteSmsActive: compte.alerteSmsActive ?? false,
        });
      },
    });
    // Le profil : description, compétences, expérience, photo, réalisations
    this.api.monProfil(this.proId).subscribe({
      next: (profil) => {
        this.profil.set(profil);
        this.form.patchValue({
          description: profil.description ?? '',
          competences: profil.competences ?? '',
          experience: profil.experience,
        });
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }

  invalide(nom: 'description' | 'competences' | 'experience' | 'whatsapp') {
    const c = this.form.controls[nom];
    return c.touched && c.invalid;
  }

  // ===== Informations =====

  enregistrer() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    this.demarrer();
    this.api
      .modifierProfil(this.proId, {
        description: v.description.trim() || null,
        competences: v.competences.trim() || null,
        experience: v.experience,
        whatsapp: v.whatsapp.trim() || null,
        alerteSmsActive: v.alerteSmsActive,
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (profil) => {
          this.profil.set(profil);
          this.success.set('Profil enregistré.');
          this.rechargerCompte();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Photo de profil =====

  changerPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const photo = input.files?.[0];
    input.value = '';
    if (!photo) return;
    if (!FORMATS_IMAGE.includes(photo.type)) {
      this.error.set('La photo doit être en JPG ou PNG.');
      return;
    }
    this.demarrer();
    this.api
      .changerPhoto(this.proId, photo)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (profil) => {
          this.profil.set(profil);
          this.versionPhoto.set(Date.now());
          this.success.set('Photo changée.');
          this.rechargerCompte();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Réalisations =====

  choisirFichierRealisation(event: Event) {
    const photo = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (photo && !FORMATS_IMAGE.includes(photo.type)) {
      this.error.set('La photo doit être en JPG ou PNG.');
      this.fichierRealisation.set(null);
      return;
    }
    this.fichierRealisation.set(photo);
  }

  ajouterRealisation(input: HTMLInputElement) {
    this.formRealisation.markAllAsTouched();
    const photo = this.fichierRealisation();
    if (!photo) {
      this.error.set('Choisissez une photo pour la réalisation.');
      return;
    }
    if (this.formRealisation.invalid || this.busy()) return;
    const v = this.formRealisation.getRawValue();
    this.demarrer();
    this.api
      .ajouterRealisation(this.proId, photo, v.titre.trim(), v.description.trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Réalisation ajoutée.');
          this.formRealisation.reset();
          this.fichierRealisation.set(null);
          input.value = '';
          this.rechargerProfil();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  supprimerRealisation(id: number) {
    if (this.busy()) return;
    this.demarrer();
    this.api
      .supprimerRealisation(this.proId, id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Réalisation supprimée.');
          this.rechargerProfil();
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // ===== Petites aides =====

  private demarrer() {
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
  }

  private rechargerProfil() {
    this.api.monProfil(this.proId).subscribe({ next: (p) => this.profil.set(p) });
  }

  // Modifier le profil peut faire repasser le pro de « correction demandée » à « en attente »
  private rechargerCompte() {
    this.monCompteService.consulter().subscribe({ next: (c) => this.compte.set(c) });
  }

  initiales(p: ProfilProfessionnel) {
    return ((p.prenom[0] ?? '') + (p.nom[0] ?? '')).toUpperCase();
  }
}
