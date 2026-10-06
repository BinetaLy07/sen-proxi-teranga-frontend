import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionInfo } from '../../core/auth/auth.models';
import { MonCompte, MonCompteService } from '../../core/auth/mon-compte.service';
import { MotDePasseService } from '../../core/auth/mot-de-passe.service';
import { apiError } from '../../core/http/api-error';

// « Mon compte » : 3 blocs
// 1. Mes informations (lire et modifier)  -> GET / PUT /api/auth/moi
// 2. Changer mon mot de passe             -> PATCH /api/auth/mot-de-passe
// 3. Mes sessions (travail de l'encadreur) -> /api/auth/sessions
@Component({ imports: [DatePipe, ReactiveFormsModule], templateUrl: './account.html' })
export class Account {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly monCompteService = inject(MonCompteService);
  private readonly motDePasseService = inject(MotDePasseService);
  private readonly fb = inject(FormBuilder).nonNullable;

  // ---------- 1. Mes informations ----------
  readonly compte = signal<MonCompte | null>(null);
  readonly edition = signal(false);
  readonly infosBusy = signal(false);
  readonly infosError = signal('');
  readonly infosSuccess = signal('');

  readonly libelleRole = computed(() => {
    const role = this.auth.session()?.role;
    return role === 'PROFESSIONNEL'
      ? 'professionnel'
      : role === 'ADMINISTRATEUR'
        ? 'administrateur'
        : 'client';
  });

  readonly formInfos = this.fb.group({
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    telephone: ['', [Validators.required, Validators.pattern(/^(\+221)?(7[05678]|33)\d{7}$/)]],
    adresse: ['', Validators.maxLength(255)],
  });

  // ---------- 2. Changer mon mot de passe ----------
  readonly mdpBusy = signal(false);
  readonly mdpError = signal('');
  readonly mdpSuccess = signal('');
  readonly mdpVisible = signal(false);

  readonly formMdp = this.fb.group(
    {
      ancienMotDePasse: ['', Validators.required],
      nouveauMotDePasse: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
          (c: AbstractControl) =>
            new TextEncoder().encode(c.value || '').length > 72 ? { passwordBytes: true } : null,
        ],
      ],
      confirmation: ['', Validators.required],
    },
    {
      validators: (group: AbstractControl) =>
        group.get('nouveauMotDePasse')?.value === group.get('confirmation')?.value
          ? null
          : { mismatch: true },
    },
  );

  // ---------- 3. Mes sessions ----------
  readonly sessions = signal<SessionInfo[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);

  constructor() {
    this.chargerCompte();
    this.load();
  }

  // ===== 1. Mes informations =====

  chargerCompte() {
    this.monCompteService.consulter().subscribe({
      next: (compte) => this.compte.set(compte),
      error: (error) => this.infosError.set(apiError(error)),
    });
  }

  // Ouvre le formulaire, rempli avec les informations actuelles
  modifierInfos() {
    const c = this.compte();
    if (!c) return;
    this.formInfos.setValue({
      prenom: c.prenom,
      nom: c.nom,
      telephone: c.telephone,
      adresse: c.adresse ?? '',
    });
    this.infosError.set('');
    this.infosSuccess.set('');
    this.edition.set(true);
  }

  annulerInfos() {
    this.edition.set(false);
    this.infosError.set('');
  }

  infoInvalide(name: 'prenom' | 'nom' | 'telephone' | 'adresse') {
    const c = this.formInfos.controls[name];
    return c.touched && c.invalid;
  }

  enregistrerInfos() {
    if (this.infosBusy()) return;
    this.formInfos.markAllAsTouched();
    if (this.formInfos.invalid) return;
    const v = this.formInfos.getRawValue();
    this.infosBusy.set(true);
    this.infosError.set('');
    this.monCompteService
      .modifier({
        prenom: v.prenom.trim(),
        nom: v.nom.trim(),
        telephone: v.telephone.trim(),
        adresse: v.adresse.trim() || null,
        // Le quartier ne se change pas encore ici : on garde l'actuel
        zoneId: this.compte()?.zoneId ?? null,
      })
      .pipe(finalize(() => this.infosBusy.set(false)))
      .subscribe({
        next: (compte) => {
          this.compte.set(compte);
          this.edition.set(false);
          this.infosSuccess.set('Vos informations sont enregistrées.');
        },
        error: (error) => this.infosError.set(apiError(error)),
      });
  }

  // ===== 2. Changer mon mot de passe =====

  mdpInvalide(name: 'ancienMotDePasse' | 'nouveauMotDePasse' | 'confirmation') {
    const c = this.formMdp.controls[name];
    return c.touched && c.invalid;
  }

  changerMotDePasse() {
    if (this.mdpBusy()) return;
    this.formMdp.markAllAsTouched();
    if (this.formMdp.invalid) return;
    const { ancienMotDePasse, nouveauMotDePasse } = this.formMdp.getRawValue();
    this.mdpBusy.set(true);
    this.mdpError.set('');
    this.mdpSuccess.set('');
    this.motDePasseService
      .changer(ancienMotDePasse, nouveauMotDePasse)
      .pipe(finalize(() => this.mdpBusy.set(false)))
      .subscribe({
        next: (reponse) => {
          this.mdpSuccess.set(reponse.message);
          this.formMdp.reset();
          // Les autres connexions ont été fermées : on recharge la liste des sessions
          this.load();
        },
        error: (error) => this.mdpError.set(apiError(error)),
      });
  }

  // ===== 3. Mes sessions (code de l'encadreur, inchangé) =====

  load() {
    this.loading.set(true);
    this.auth.sessions().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(apiError(error));
        this.loading.set(false);
      },
    });
  }
  revoke(session: SessionInfo) {
    this.auth.revoke(session.id).subscribe({
      next: () => {
        if (session.current) {
          this.auth.clear();
          void this.router.navigate(['/connexion']);
        } else this.load();
      },
      error: (error) => this.error.set(apiError(error)),
    });
  }
  logout(all = false) {
    this.auth.logout(all).subscribe({
      next: () => {
        void this.router.navigate(['/connexion']);
      },
      error: () => {
        void this.router.navigate(['/connexion']);
      },
    });
  }
}