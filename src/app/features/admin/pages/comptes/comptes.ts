import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiError } from '../../../../core/http/api-error';
import { CompteUtilisateur, ETIQUETTES_VERIFICATION } from '../../data-access/admin.models';
import { AdminApiService } from '../../data-access/admin-api.service';

type RoleListe = 'CLIENT' | 'PROFESSIONNEL';

// « Comptes » : l'administrateur suspend ou réactive un compte.
// Un compte suspendu est déconnecté tout de suite et ne peut plus se connecter.
@Component({ imports: [DatePipe, ReactiveFormsModule], templateUrl: './comptes.html' })
export class Comptes {
  private readonly adminApi = inject(AdminApiService);

  readonly etiquettes = ETIQUETTES_VERIFICATION;
  readonly listes: { cle: RoleListe; libelle: string }[] = [
    { cle: 'CLIENT', libelle: 'Clients' },
    { cle: 'PROFESSIONNEL', libelle: 'Professionnels' },
  ];

  readonly role = signal<RoleListe>('CLIENT');
  readonly comptes = signal<CompteUtilisateur[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyId = signal<number | null>(null);
  readonly message = signal('');

  // La recherche : toSignal transforme les frappes du champ en signal
  readonly recherche = new FormControl('', { nonNullable: true });
  private readonly texte = toSignal(this.recherche.valueChanges, { initialValue: '' });

  // Les plus récents d'abord, puis filtrés par nom, téléphone ou email
  readonly affiches = computed(() => {
    const texte = this.texte().trim().toLowerCase();
    return [...this.comptes()]
      .reverse()
      .filter(
        (c) =>
          texte === '' ||
          `${c.prenom} ${c.nom} ${c.telephone} ${c.email}`.toLowerCase().includes(texte),
      );
  });

  readonly nombreSuspendus = computed(
    () => this.comptes().filter((c) => c.statutCompte === 'SUSPENDU').length,
  );

  constructor() {
    this.charger();
  }

  afficher(role: RoleListe) {
    if (role === this.role()) return;
    this.role.set(role);
    this.recherche.setValue('');
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.comptes.set([]);
    this.adminApi
      .comptes(this.role())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (liste) => this.comptes.set(liste),
        error: (error) => this.error.set(apiError(error)),
      });
  }

  changerStatut(c: CompteUtilisateur) {
    if (this.busyId() !== null) return;
    const suspendre = c.statutCompte === 'ACTIF';
    const nom = `${c.prenom} ${c.nom}`;
    const question = suspendre
      ? `Suspendre le compte de ${nom} ? Cette personne sera déconnectée et ne pourra plus se connecter.`
      : `Réactiver le compte de ${nom} ?`;
    if (!confirm(question)) return;

    this.busyId.set(c.id);
    this.error.set('');
    this.message.set('');
    this.adminApi
      .changerStatutCompte(c.id, suspendre ? 'SUSPENDU' : 'ACTIF')
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (compte) => {
          // Le backend renvoie le compte à jour : on le remplace dans la liste
          this.comptes.update((liste) => liste.map((x) => (x.id === compte.id ? compte : x)));
          this.message.set(`Compte de ${nom} ${suspendre ? 'suspendu' : 'réactivé'}.`);
        },
        error: (error) => this.error.set(apiError(error)),
      });
  }
}
