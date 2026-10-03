import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { apiError } from '../../../core/http/api-error';
@Component({ imports: [ReactiveFormsModule, RouterLink], templateUrl: './register.html' })
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly role = signal<'CLIENT' | 'PROFESSIONNEL'>('CLIENT');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly visible = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      prenom: ['', [Validators.required, Validators.maxLength(100)]],
      nom: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      telephone: ['', [Validators.required, Validators.pattern(/^(\+221)?(7[05678]|33)\d{7}$/)]],
      motDePasse: [
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
      metier: ['', Validators.maxLength(100)],
      cguAcceptees: [false, Validators.requiredTrue],
    },
    {
      validators: (group: AbstractControl) =>
        group.get('motDePasse')?.value === group.get('confirmation')?.value
          ? null
          : { mismatch: true },
    },
  );
  selectRole(role: 'CLIENT' | 'PROFESSIONNEL') {
    this.role.set(role);
    const c = this.form.controls.metier;
    c.setValidators(
      role === 'PROFESSIONNEL'
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );
    c.updateValueAndValidity();
  }
  invalid(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }
  submit() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.auth
      .register({
        prenom: v.prenom.trim(),
        nom: v.nom.trim(),
        email: v.email.trim(),
        telephone: v.telephone.trim(),
        motDePasse: v.motDePasse,
        cguAcceptees: v.cguAcceptees,
        role: this.role(),
        ...(this.role() === 'PROFESSIONNEL' ? { metier: v.metier.trim() } : {}),
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/connexion'], { queryParams: { inscription: 'ok' } });
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
