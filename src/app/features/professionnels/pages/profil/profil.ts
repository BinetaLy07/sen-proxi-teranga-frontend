import { Component, computed, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MonCompte, MonCompteService } from '../../../../core/auth/mon-compte.service';
import { apiError } from '../../../../core/http/api-error';
import { DemandeApiService } from '../../../demandes/data-access/demande-api.service';
import { FavoriApiService } from '../../../favoris/data-access/favori-api.service';
import { Zone } from '../../../zones/data-access/zone.models';
import { ZoneApiService } from '../../../zones/data-access/zone-api.service';
import {
  ContactPro,
  ProfilProfessionnel,
  ServicePro,
} from '../../data-access/professionnel.models';
import { ProfessionnelApiService } from '../../data-access/professionnel-api.service';

// Les règles du backend pour les fichiers joints
const MAX_FICHIERS = 5;
const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo
const FORMATS = ['image/jpeg', 'image/png', 'video/mp4'];

// Le profil d'un professionnel (vu par un client). Deux écrans, choisis par l'adresse :
// - /professionnels/2                       -> le profil, avec ses services ;
// - /professionnels/2?demande=1&service=7   -> seulement le formulaire « Faire une demande ».
// Chaque service a son chemin, selon son tarif :
// - prix fixe  -> « Réserver » : fenêtre de confirmation, puis le chat s'ouvre
//                 avec un message déjà écrit ;
// - sur devis  -> « Demander un devis » : fenêtre de confirmation (adresse, un mot), envoi,
//                 et on reste sur le profil (message vert) : le pro est prévenu par notification ;
// - à partir de -> « Faire une demande » : le formulaire complet, service déjà choisi.
@Component({ imports: [DatePipe, ReactiveFormsModule, RouterLink], templateUrl: './profil.html' })
export class Profil {
  private readonly professionnelApi = inject(ProfessionnelApiService);
  private readonly demandeApi = inject(DemandeApiService);
  private readonly favoriApi = inject(FavoriApiService);
  private readonly zoneApi = inject(ZoneApiService);
  private readonly monCompteService = inject(MonCompteService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  // L'id du pro vient de l'adresse : /professionnels/2
  private readonly route = inject(ActivatedRoute);
  readonly professionnelId = Number(this.route.snapshot.paramMap.get('id'));
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
  // Les boutons « WhatsApp » et « Appeler »
  readonly contact = signal<ContactPro | null>(null);
  // Vrai si le fichier du logo WhatsApp n'a pas été trouvé : on affiche 💬 à la place
  readonly logoManquant = signal(false);
  readonly lienAppel = computed(() => {
    const c = this.contact();
    return c ? 'tel:+' + numeroInternational(c.telephone) : null;
  });
  readonly lienWhatsapp = computed(() => {
    const c = this.contact();
    const p = this.profil();
    if (!c?.whatsapp) return null;
    // Un premier message déjà écrit : le client n'a plus qu'à l'envoyer (ou à faire un vocal)
    const texte = `Bonjour ${p?.prenom ?? ''}, je vous ai trouvé sur Sen Proxi Teranga.`;
    return `https://wa.me/${numeroInternational(c.whatsapp)}?text=${encodeURIComponent(texte)}`;
  });

  readonly favori = signal(false);
  readonly favoriBusy = signal(false);

  // ---------- Les deux écrans ----------
  // false : le profil ; true : seulement le formulaire « Faire une demande »
  readonly modeDemande = signal(false);
  // Le compte du client (son adresse sert aux demandes rapides)
  readonly compte = signal<MonCompte | null>(null);

  // ---------- La petite fenêtre « Demander un devis » (ou « Réserver » sans adresse) ----------
  readonly fenetre = signal<{ service: ServicePro; type: 'devis' | 'reserver' } | null>(null);
  readonly rapide = inject(FormBuilder).nonNullable.group({
    adresse: ['', [Validators.required, Validators.maxLength(255)]],
    mot: ['', Validators.maxLength(500)],
  });
  readonly rapideBusy = signal(false);
  readonly rapideError = signal('');
  // Après une demande de devis : le message vert sur le profil, et l'id pour « Voir ma demande »
  readonly devisEnvoye = signal<{ demandeId: number; texte: string } | null>(null);

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

    // Les numéros du pro pour les boutons « WhatsApp » et « Appeler »
    this.professionnelApi.contact(this.professionnelId).subscribe({
      next: (c) => this.contact.set(c),
      error: () => this.contact.set(null), // pas de boutons si on ne peut pas les obtenir
    });

    // Pour proposer les quartiers dans le formulaire
    this.zoneApi.lister().subscribe({
      next: (zones) => this.quartiers.set(zones.filter((z) => z.type === 'QUARTIER')),
      error: () => this.quartiers.set([]),
    });

    // Pré-remplir l'adresse et le quartier avec ceux du client (« Mon compte »)
    this.monCompteService.consulter().subscribe({
      next: (compte) => {
        this.compte.set(compte);
        if (compte.adresse) this.form.controls.adresse.setValue(compte.adresse);
        if (compte.zoneId) this.form.controls.zoneId.setValue(String(compte.zoneId));
      },
    });

    // Quel écran ? (?demande=1 : le formulaire ; &service=7 : ce service déjà choisi)
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.modeDemande.set(q.has('demande'));
      const service = q.get('service');
      if (service) this.form.controls.serviceId.setValue(service);
      this.demandeSuccess.set('');
      this.demandeError.set('');
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

  // ===== Les chemins rapides : « Réserver » et « Demander un devis » =====

  // Prix fixe et sur devis : d'abord une fenêtre de confirmation (« Voulez-vous vraiment… ? »)
  reserver(s: ServicePro) {
    this.ouvrirFenetre(s, 'reserver');
  }

  demanderDevis(s: ServicePro) {
    this.ouvrirFenetre(s, 'devis');
  }

  private ouvrirFenetre(s: ServicePro, type: 'devis' | 'reserver') {
    this.rapide.reset({ adresse: this.compte()?.adresse ?? '', mot: '' });
    this.rapideError.set('');
    this.fenetre.set({ service: s, type });
  }

  fermerFenetre() {
    if (!this.rapideBusy()) this.fenetre.set(null);
  }

  envoyerRapide() {
    const f = this.fenetre();
    this.rapide.markAllAsTouched();
    if (!f || this.rapide.invalid) return;
    const v = this.rapide.getRawValue();
    this.creerRapide(f.service, f.type, v.adresse.trim(), v.mot.trim());
  }

  // La demande est créée (le pro est prévenu), puis on ouvre le chat de cette demande.
  // Pour une réservation, le message d'accompagnement est déjà écrit dans la barre du bas.
  private creerRapide(s: ServicePro, type: 'devis' | 'reserver', adresse: string, mot: string) {
    if (this.rapideBusy()) return;
    const prenom = this.profil()?.prenom ?? '';
    const description =
      (type === 'reserver'
        ? `Réservation : « ${s.titre} » (${this.prix(s)}).`
        : `Demande de devis pour « ${s.titre} ».`) + (mot ? ' ' + mot : '');
    this.rapideBusy.set(true);
    this.rapideError.set('');
    this.demandeApi
      .creer(this.clientId, {
        serviceId: s.id,
        description,
        adresse,
        dateSouhaitee: this.aujourdhui,
        urgente: false,
        visiteDemandee: false,
        zoneId: this.compte()?.zoneId ?? null,
      })
      .pipe(finalize(() => this.rapideBusy.set(false)))
      .subscribe({
        next: (demande) => {
          this.fenetre.set(null);
          // Demande de devis : on reste sur le profil (le pro est prévenu par notification)
          if (type === 'devis') {
            this.devisEnvoye.set({
              demandeId: demande.id,
              texte: `Demande envoyée à ${prenom} ${this.profil()?.nom ?? ''}. Une notification lui est arrivée : ${prenom} va préparer votre devis.`,
            });
            this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          // Réservation : on ouvre le chat, avec le message déjà écrit
          const texte =
            type === 'reserver'
              ? `Bonjour ${prenom}, je souhaite réserver « ${s.titre} » (${this.prix(s)}). Quand êtes-vous disponible ?`
              : '';
          void this.router.navigate(['/messages'], {
            queryParams: { demande: demande.id, texte },
          });
        },
        error: (error) => {
          // Sans fenêtre ouverte (réservation directe), on l'ouvre pour montrer l'erreur
          if (!this.fenetre()) this.ouvrirFenetre(s, type);
          this.rapideError.set(apiError(error));
        },
      });
  }

  // ===== Petites aides pour l'affichage =====

  // 5000 -> "5 000 F"
  prix(service: ServicePro) {
    return service.montant != null ? service.montant.toLocaleString('fr-FR') + ' F' : '';
  }

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

// "771234567" ou "+221 77 123 45 67" -> "221771234567" (le format attendu par wa.me et tel:)
function numeroInternational(numero: string) {
  const chiffres = numero.replace(/\D/g, '');
  return chiffres.startsWith('221') ? chiffres : '221' + chiffres;
}
