import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { InscriptionService } from '../../../core/auth/inscription.service';
import { apiError } from '../../../core/http/api-error';
import { Zone } from '../../zones/data-access/zone.models';
import { ZoneApiService } from '../../zones/data-access/zone-api.service';

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

// « Créer un compte » en 2 étapes :
// 1. on choisit son rôle (client ou professionnel) ;
// 2. on remplit le formulaire de ce rôle.
// On peut arriver directement à l'étape 2 avec /inscription?role=PROFESSIONNEL (accueil).
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

  // Les quartiers (pour le client : son quartier ; pour le pro : ses zones d'intervention)
  readonly zones = signal<Zone[]>([]);
  readonly quartiers = computed(() => this.zones().filter((z) => z.type === 'QUARTIER'));
  readonly communes = computed(() => this.zones().filter((z) => z.type === 'COMMUNE'));
  readonly zonesChoisies = signal<number[]>([]);

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
      // Client (facultatifs)
      adresse: ['', Validators.maxLength(255)],
      zoneId: [''],
      // Professionnel
      metier: ['', Validators.maxLength(100)],
      description: ['', Validators.maxLength(2000)],
      whatsapp: ['', Validators.pattern(/^(\+221)?7[05678]\d{7}$/)],
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
    inject(ZoneApiService)
      .lister()
      .subscribe({ next: (liste) => this.zones.set(liste) });
    // Bouton « Créer mon profil professionnel » de l'accueil : on saute l'étape 1
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('role') === 'PROFESSIONNEL') {
      this.choisir('PROFESSIONNEL');
      this.etape.set(2);
    }
  }

  // ===== Étape 1 =====

  choisir(role: RoleInscription) {
    this.role.set(role);
    // Le métier n'est obligatoire que pour un professionnel
    const metier = this.form.controls.metier;
    metier.setValidators(
      role === 'PROFESSIONNEL'
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );
    metier.updateValueAndValidity();
  }

  continuer() {
    this.error.set('');
    this.etape.set(2);
  }

  changerDeRole() {
    this.error.set('');
    this.etape.set(1);
  }

  // ===== Étape 2 =====

  // Zones d'intervention du pro : un clic ajoute ou retire le quartier
  basculerZone(id: number) {
    this.zonesChoisies.update((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id],
    );
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

    // Les informations communes aux deux rôles
    const commun = {
      prenom: v.prenom.trim(),
      nom: v.nom.trim(),
      telephone: v.telephone.trim(),
      email: v.email.trim(),
      motDePasse: v.motDePasse,
      cguAcceptees: v.cguAcceptees,
    };
    const requete: Observable<unknown> =
      this.role() === 'CLIENT'
        ? this.inscription.inscrireClient({
            ...commun,
            adresse: v.adresse.trim() || null,
            zoneId: v.zoneId ? Number(v.zoneId) : null,
          })
        : this.inscription.inscrireProfessionnel({
            ...commun,
            metier: v.metier.trim(),
            competences: null,
            description: v.description.trim() || null,
            whatsapp: v.whatsapp.trim() || null,
            zoneIds: this.zonesChoisies(),
          });

    this.busy.set(true);
    this.error.set('');
    requete.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => void this.router.navigate(['/connexion'], { queryParams: { inscription: 'ok' } }),
      error: (error) => this.error.set(apiError(error)),
    });
  }
}
