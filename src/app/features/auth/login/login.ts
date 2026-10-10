import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ACCUEIL_ROLE } from '../../../core/auth/accueil-role';
import { AuthService } from '../../../core/auth/auth.service';
import { apiError } from '../../../core/http/api-error';
import { BienvenueService } from '../../../shared/components/fenetre-bienvenue/bienvenue.service';
@Component({ imports: [ReactiveFormsModule, RouterLink], templateUrl: './login.html' })
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly bienvenue = inject(BienvenueService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly registered = this.params.get('inscription') === 'ok';
  // Retour de « Mot de passe oublié » : le mot de passe vient d'être changé
  readonly reinitialise = this.params.get('reinitialisation') === 'ok';
  // Page demandée avant la connexion (posée par authGuard), ex : "/recherche?metier=plombier"
  private readonly retour = this.params.get('retour');
  readonly form = inject(FormBuilder).nonNullable.group({
    // Le numéro de téléphone OU l'email
    identifiant: ['', [Validators.required, Validators.maxLength(150)]],
    motDePasse: ['', Validators.required],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly visible = signal(false);
  invalid(name: 'identifiant' | 'motDePasse') {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }
  submit() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const { identifiant, motDePasse } = this.form.getRawValue();
    this.auth
      .login(identifiant.trim(), motDePasse)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (tokens) => {
          // 1re connexion juste après l'inscription : la fenêtre de fête (une seule fois)
          if (tokens.premiereConnexion) {
            this.bienvenue.afficher(tokens.prenom ?? '', tokens.nom ?? '', tokens.role);
          }
          // Sécurité : on n'accepte qu'une adresse interne ("/…", jamais "//autre-site")
          const interne = this.retour?.startsWith('/') && !this.retour.startsWith('//');
          // Sinon, chacun arrive sur son tableau de bord (client, pro ou admin)
          void this.router.navigateByUrl(
            interne && this.retour ? this.retour : ACCUEIL_ROLE[tokens.role],
          );
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
