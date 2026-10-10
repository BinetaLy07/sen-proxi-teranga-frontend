import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Vocal } from '../../../features/messages/data-access/message.models';
import { ChoixEmoji } from '../choix-emoji/choix-emoji';

// Durée maximale d'un message vocal (même règle que le serveur)
const DUREE_MAX = 120;

// La barre en bas d'une discussion, comme WhatsApp :
// - un bouton 😊 (grille d'emojis), un champ « Écrire un message… » et UN bouton rond ;
// - champ vide : le bouton est un MICRO (on appuie pour enregistrer un vocal) ;
// - on écrit : le bouton devient une FLÈCHE (envoyer le texte) ;
// - pendant l'enregistrement : 🗑 (annuler), le temps qui défile, la flèche (envoyer le vocal).
// La barre ne parle pas au serveur : elle prévient la page (texte / vocal), qui envoie,
// puis la page appelle vider() quand le message est bien parti.
@Component({
  selector: 'app-barre-saisie',
  imports: [ReactiveFormsModule, ChoixEmoji],
  templateUrl: './barre-saisie.html',
  // Un clic ailleurs sur la page ferme la grille d'emojis
  host: { '(document:click)': 'fermerSiDehors($event)' },
})
export class BarreSaisie {
  readonly placeholder = input('Écrire un message…');
  // Un envoi est en cours : on bloque les boutons
  readonly busy = input(false);
  // Un message déjà écrit (ex. après « Réserver » sur un profil) : il apparaît dans le champ,
  // le client peut le modifier puis l'envoyer
  readonly texteInitial = input('');

  readonly texte = output<string>();
  readonly vocal = output<Vocal>();

  readonly champ = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)],
  });
  // Le texte tapé, pour savoir s'il faut montrer le micro ou la flèche
  private readonly valeur = toSignal(this.champ.valueChanges, { initialValue: '' });

  // La grille d'emojis est-elle ouverte ?
  readonly emojisOuverts = signal(false);
  private readonly hote = inject(ElementRef<HTMLElement>);
  private readonly saisie = viewChild<ElementRef<HTMLInputElement>>('saisie');

  readonly enregistrement = signal(false);
  readonly secondes = signal(0);
  readonly erreur = signal('');

  private enregistreur: MediaRecorder | null = null;
  private flux: MediaStream | null = null;
  private morceaux: Blob[] = [];
  private debut = 0;
  private minuterie: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // On met le message déjà écrit dans le champ (une seule fois par texte reçu)
    let dejaMis = '';
    effect(() => {
      const texte = this.texteInitial();
      if (texte && texte !== dejaMis) {
        dejaMis = texte;
        this.champ.setValue(texte);
      }
    });
    // Si on quitte la page pendant un enregistrement : on coupe le micro
    inject(DestroyRef).onDestroy(() => this.arreter(false));
  }

  // true : on montre la flèche ; false : on montre le micro
  aDuTexte() {
    return this.valeur().trim().length > 0;
  }

  // Le texte est parti : on vide le champ (appelé par la page)
  vider() {
    this.champ.reset();
  }

  // Appelé par (submit) : preventDefault() empêche le navigateur de recharger la page
  envoyerTexte(event?: Event) {
    event?.preventDefault();
    const texte = this.champ.value.trim();
    if (!texte || this.champ.invalid || this.busy()) return;
    this.emojisOuverts.set(false);
    this.texte.emit(texte);
  }

  // ===================== Emojis =====================

  basculerEmojis() {
    this.emojisOuverts.update((v) => !v);
  }

  // Ajoute l'emoji LÀ OÙ SE TROUVE LE CURSEUR dans le texte (pas forcément à la fin)
  ajouterEmoji(emoji: string) {
    const champ = this.saisie()?.nativeElement;
    const texte = this.champ.value;
    const debut = champ?.selectionStart ?? texte.length;
    const fin = champ?.selectionEnd ?? texte.length;
    this.champ.setValue(texte.slice(0, debut) + emoji + texte.slice(fin));
    // On remet le curseur juste après l'emoji, pour continuer à écrire
    const position = debut + emoji.length;
    setTimeout(() => {
      champ?.focus();
      champ?.setSelectionRange(position, position);
    });
  }

  fermerSiDehors(event: Event) {
    if (this.emojisOuverts() && !this.hote.nativeElement.contains(event.target as Node)) {
      this.emojisOuverts.set(false);
    }
  }

  // ===================== Message vocal =====================

  async demarrer() {
    this.erreur.set('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.erreur.set("Votre navigateur ne permet pas d'enregistrer un message vocal.");
      return;
    }
    try {
      // Le navigateur demande la permission d'utiliser le micro (une seule fois)
      this.flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.erreur.set('Autorisez le micro dans votre navigateur pour envoyer un message vocal.');
      return;
    }

    // Chrome et Firefox enregistrent en "webm", Safari (iPhone) en "mp4"
    const format = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((f) =>
      MediaRecorder.isTypeSupported(f),
    );
    this.enregistreur = new MediaRecorder(this.flux, format ? { mimeType: format } : undefined);
    this.morceaux = [];
    this.enregistreur.ondataavailable = (e) => {
      if (e.data.size > 0) this.morceaux.push(e.data);
    };
    this.enregistreur.start();

    this.debut = Date.now();
    this.secondes.set(0);
    this.enregistrement.set(true);
    this.minuterie = setInterval(() => {
      const s = Math.floor((Date.now() - this.debut) / 1000);
      this.secondes.set(s);
      // 2 minutes atteintes : on envoie automatiquement
      if (s >= DUREE_MAX) this.envoyerVocal();
    }, 250);
  }

  // 🗑 : on jette l'enregistrement
  annuler() {
    this.arreter(false);
  }

  // ➤ : on arrête et on envoie
  envoyerVocal() {
    this.arreter(true);
  }

  private arreter(envoyer: boolean) {
    if (this.minuterie !== null) clearInterval(this.minuterie);
    this.minuterie = null;
    this.enregistrement.set(false);

    const enregistreur = this.enregistreur;
    this.enregistreur = null;
    if (enregistreur === null) return;

    const duree = Math.min(DUREE_MAX, Math.max(1, Math.round((Date.now() - this.debut) / 1000)));
    // Le son complet n'est disponible qu'une fois l'enregistreur arrêté
    enregistreur.onstop = () => {
      this.flux?.getTracks().forEach((piste) => piste.stop()); // le voyant du micro s'éteint
      this.flux = null;
      if (envoyer && this.morceaux.length > 0) {
        // "audio/webm;codecs=opus" -> "audio/webm"
        const type = (enregistreur.mimeType || 'audio/webm').split(';')[0];
        this.vocal.emit({ fichier: new Blob(this.morceaux, { type }), duree });
      }
      this.morceaux = [];
    };
    if (enregistreur.state !== 'inactive') {
      enregistreur.stop();
    } else {
      enregistreur.onstop(new Event('stop'));
    }
  }

  // 7 -> "0:07"
  temps() {
    const s = this.secondes();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
