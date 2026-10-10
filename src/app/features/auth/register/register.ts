import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { InscriptionService } from '../../../core/auth/inscription.service';
import { apiError } from '../../../core/http/api-error';

type RoleInscription = 'CLIENT' | 'PROFESSIONNEL';

// Des suggestions pour le champ « Métier » (on peut aussi écrire un autre métier)
const METIERS = [
  'Plombier',
  'Électricien',
  'Menuisier',
  'Maçon',
  'Carreleur',
  'Peintre',
  'Couturier',
  'Frigoriste',
  'Mécanicien',
  'Soudeur',
  'Coiffeur',
  'Jardinier',
];

// Un numéro de portable sénégalais (WhatsApp fonctionne sur les portables, pas sur les fixes 33)
const PORTABLE = /^(\+221)?7[05678]\d{7}$/;

// « Créer un compte » en 2 étapes :
// 1. on choisit son rôle (client ou professionnel) ;
// 2. on remplit le formulaire de ce rôle.
// On peut arriver directement à l'étape 2 avec /inscription?role=PROFESSIONNEL (accueil).
//
// Tous les champs sont obligatoires, sauf WhatsApp.
// Les messages d'erreur n'apparaissent qu'après un clic sur le bouton, sous les champs oubliés.
@Component({ imports: [ReactiveFormsModule, RouterLink], templateUrl: './register.html' })
export class Register {
  private readonly inscription = inject(InscriptionService);
  private readonly router = inject(Router);

  readonly metiers = METIERS;
  readonly etape = signal<1 | 2>(1);
  readonly role = signal<RoleInscription>('CLIENT');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly visible = signal(false);
  // Devient vrai au premier clic sur le bouton : on peut alors montrer les champs oubliés
  readonly soumis = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      prenom: ['', [Validators.required, Validators.maxLength(100)]],
      nom: ['', [Validators.required, Validators.maxLength(100)]],
      // Facultatif : beaucoup d'utilisateurs n'ont pas d'email (on se connecte avec le téléphone)
      email: ['', [Validators.email, Validators.maxLength(150)]],
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
      // Client
      adresse: [''],
      quartier: [''],
      // Professionnel
      metier: [''],
      description: [''],
      zones: [''],
      // WhatsApp : par défaut, c'est le même numéro que le téléphone
      whatsappIdentique: [true],
      whatsapp: ['', Validators.pattern(PORTABLE)],
      cguAcceptees: [false, Validators.requiredTrue],
    },
    {
      validators: (group: AbstractControl) =>
        group.get('motDePasse')?.value === group.get('confirmation')?.value
          ? null
          : { mismatch: true },
    },
  );

  constructor() {
    // Bouton « Créer mon profil professionnel » de l'accueil : on saute l'étape 1
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('role') === 'PROFESSIONNEL') {
      this.choisir('PROFESSIONNEL');
      this.etape.set(2);
    } else {
      // Par défaut c'est un compte client : on active tout de suite ses règles
      this.choisir('CLIENT');
    }
  }

  // ===== Étape 1 =====

  choisir(role: RoleInscription) {
    this.role.set(role);
    // Chaque rôle a ses propres champs obligatoires : on active les bonnes règles
    const pro = role === 'PROFESSIONNEL';
    const c = this.form.controls;
    this.regles(c.adresse, !pro, [Validators.maxLength(255)]);
    this.regles(c.quartier, !pro, [Validators.maxLength(100)]);
    this.regles(c.metier, pro, [Validators.maxLength(100)]);
    this.regles(c.description, pro, [Validators.maxLength(2000)]);
    this.regles(c.zones, pro, [Validators.maxLength(500)]);
  }

  continuer() {
    this.error.set('');
    this.soumis.set(false);
    this.etape.set(2);
  }

  changerDeRole() {
    this.error.set('');
    this.etape.set(1);
  }

  // ===== Étape 2 =====

  // Un champ est montré en rouge seulement après un clic sur le bouton
  invalid(name: keyof typeof this.form.controls) {
    return this.soumis() && this.form.controls[name].invalid;
  }

  motsDePasseDifferents() {
    return this.soumis() && this.form.hasError('mismatch');
  }

  submit() {
    if (this.busy()) return;
    this.soumis.set(true);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    // Les informations communes aux deux rôles
    const commun = {
      prenom: v.prenom.trim(),
      nom: v.nom.trim(),
      telephone: v.telephone.trim(),
      email: v.email.trim() || null,
      motDePasse: v.motDePasse,
      cguAcceptees: v.cguAcceptees,
    };
    const requete: Observable<unknown> =
      this.role() === 'CLIENT'
        ? this.inscription.inscrireClient({
            ...commun,
            adresse: v.adresse.trim(),
            quartier: v.quartier.trim(),
          })
        : this.inscription.inscrireProfessionnel({
            ...commun,
            metier: v.metier.trim(),
            competences: null,
            description: v.description.trim(),
            whatsapp: this.numeroWhatsapp(v.whatsappIdentique, v.telephone, v.whatsapp),
            zones: v.zones.trim(),
          });

    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => void this.router.navigate(['/connexion'], { queryParams: { inscription: 'ok' } }),
      error: (error) => this.error.set(apiError(error)),
    });
  }

  // Le numéro WhatsApp à enregistrer :
  // - case cochée : le numéro de téléphone (s'il s'agit d'un portable) ;
  // - case décochée : le numéro écrit (ou rien, c'est facultatif).
  private numeroWhatsapp(identique: boolean, telephone: string, whatsapp: string) {
    const numero = (identique ? telephone : whatsapp).trim();
    return numero && PORTABLE.test(numero) ? numero : null;
  }

  // Ajoute « obligatoire » aux règles d'un champ, ou l'enlève
  private regles(champ: AbstractControl, obligatoire: boolean, autres: ValidatorFn[]) {
    champ.setValidators(obligatoire ? [Validators.required, ...autres] : autres);
    champ.updateValueAndValidity();
  }
}
