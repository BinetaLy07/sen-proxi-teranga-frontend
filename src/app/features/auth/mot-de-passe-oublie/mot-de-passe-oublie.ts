import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MotDePasseService } from '../../../core/auth/mot-de-passe.service';
import { apiError } from '../../../core/http/api-error';

// Mot de passe oublié, en 2 étapes sur la même page :
// 1. le numéro de téléphone -> le backend envoie un code à 6 chiffres par SMS
// 2. le code + le nouveau mot de passe -> retour à la connexion
@Component({ imports: [ReactiveFormsModule, RouterLink], templateUrl: './mot-de-passe-oublie.html' })
export class MotDePasseOublie {
  private readonly motDePasse = inject(MotDePasseService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly etape = signal<'telephone' | 'code'>('telephone');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly visible = signal(false);

  // Étape 1 : même règle que le backend pour le numéro
  readonly formTelephone = this.fb.group({
    telephone: ['', [Validators.required, Validators.pattern(/^(\+221)?(7[05678]|33)\d{7}$/)]],
  });

  // Étape 2 : code à 6 chiffres + nouveau mot de passe (8 à 72) + confirmation identique
  readonly formCode = this.fb.group(
    {
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
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

  // Le numéro saisi à l'étape 1 (sert aussi à l'étape 2)
  telephone() {
    return this.formTelephone.getRawValue().telephone.trim();
  }

  telephoneInvalide() {
    const c = this.formTelephone.controls.telephone;
    return c.touched && c.invalid;
  }

  invalid(name: 'code' | 'nouveauMotDePasse' | 'confirmation') {
    const c = this.formCode.controls[name];
    return c.touched && c.invalid;
  }

  // Étape 1 (et bouton « Renvoyer le code »)
  envoyerCode() {
    if (this.busy()) return;
    this.formTelephone.markAllAsTouched();
    if (this.formTelephone.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.motDePasse
      .demanderCode(this.telephone())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (reponse) => {
          this.info.set(reponse.message);
          this.etape.set('code');
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // Étape 2
  reinitialiser() {
    if (this.busy()) return;
    this.formCode.markAllAsTouched();
    if (this.formCode.invalid) return;
    const { code, nouveauMotDePasse } = this.formCode.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.motDePasse
      .reinitialiser(this.telephone(), code, nouveauMotDePasse)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/connexion'], { queryParams: { reinitialisation: 'ok' } });
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }

  // Retour à l'étape 1 (erreur de numéro)
  changerNumero() {
    this.etape.set('telephone');
    this.info.set('');
    this.error.set('');
    this.formCode.reset();
  }
}