import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { apiError } from '../../../core/http/api-error';
import { Message } from '../../../features/messages/data-access/message.models';
import { MessageApiService } from '../../../features/messages/data-access/message-api.service';
import { BulleVocale } from '../bulle-vocale/bulle-vocale';

// Un « emoji » : un pictogramme, éventuellement suivi de ses petits modificateurs
// (couleur de peau, ❤️ en couleur…). Sert à reconnaître un message fait SEULEMENT d'emojis.
const PICTOGRAMME = /\p{Extended_Pictographic}/gu;
const SEULEMENT_EMOJIS = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f\s]+$/u;

// On peut supprimer son message pendant 24 h (même règle que le serveur)
const DELAI_SUPPRESSION_MS = 24 * 60 * 60 * 1000;

// Une bulle de message, comme WhatsApp : écrit, vocal, ou « Ce message a été supprimé ».
// Sur chaque message : un bouton 🗑 (au survol de la souris, ou en touchant la bulle sur
// téléphone) qui ouvre une fenêtre avec les choix possibles :
// - « Supprimer pour tout le monde » : MES messages, pendant 24 h ;
// - « Supprimer pour moi » : n'importe quel message, même une trace « supprimé ».
// L'administrateur (lectureSeule) voit le nom de l'expéditeur, et le texte d'origine
// d'un message supprimé (preuve en cas de litige).
// Utilisée dans la page Messages et dans la discussion d'une demande.
@Component({
  selector: 'app-bulle-message',
  imports: [DatePipe, BulleVocale],
  templateUrl: './bulle-message.html',
  // La bulle se place à droite (mes messages) ou à gauche (ceux de l'autre)
  host: { '[class]': 'classesPlacement()' },
})
export class BulleMessage {
  private readonly api = inject(MessageApiService);

  readonly message = input.required<Message>();
  readonly moiId = input.required<number>();
  // true : l'administrateur lit la discussion (il ne peut rien supprimer)
  readonly lectureSeule = input(false);
  // Le message a changé (supprimé pour tout le monde) : la page met sa liste à jour
  readonly modifie = output<Message>();
  // Le message est « supprimé pour moi » : la page le retire de sa liste
  readonly masque = output<number>();

  readonly ouvert = signal(false); // bouton 🗑 affiché (après un toucher sur téléphone)
  readonly confirmation = signal(false); // fenêtre « Supprimer ce message ? »
  readonly busy = signal(false);
  readonly erreur = signal('');

  readonly deMoi = computed(() => this.message().expediteurId === this.moiId());

  // Ma bulle à droite (🗑 à sa gauche), celle de l'autre à gauche (🗑 à sa droite)
  readonly classesPlacement = computed(
    () =>
      'group flex max-w-[85%] items-center gap-2 ' +
      (this.deMoi() ? 'self-end' : 'self-start flex-row-reverse'),
  );

  // 1 à 3 emojis tout seuls (ex : « 👍 ») : affichés en grand, sans bulle, comme WhatsApp
  readonly seulEmoji = computed(() => {
    const m = this.message();
    if (m.type !== 'TEXTE' || m.supprime) return false;
    const texte = m.contenu.trim();
    const nombre = texte.match(PICTOGRAMME)?.length ?? 0;
    return SEULEMENT_EMOJIS.test(texte) && nombre >= 1 && nombre <= 3;
  });

  // Les couleurs de la bulle
  readonly classesBulle = computed(() => {
    const m = this.message();
    if (this.seulEmoji()) {
      return 'px-1 py-1 text-5xl leading-tight';
    }
    if (m.supprime && this.lectureSeule()) {
      return 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900';
    }
    if (m.supprime) {
      return 'rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-gray-500 italic';
    }
    return this.deMoi()
      ? 'rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2 text-white'
      : 'rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-gray-900';
  });

  readonly classesHeure = computed(() =>
    this.deMoi() && !this.message().supprime && !this.seulEmoji()
      ? 'text-white/80'
      : 'text-gray-500',
  );

  // « Supprimer pour moi » : tout le monde sauf l'administrateur (qui ne fait que lire)
  readonly peutMasquer = computed(() => !this.lectureSeule());

  // « Supprimer pour tout le monde » : mon message, pas encore supprimé, de moins de 24 h
  readonly peutSupprimer = computed(() => {
    const m = this.message();
    return (
      !this.lectureSeule() &&
      this.deMoi() &&
      !m.supprime &&
      Date.now() - new Date(m.dateEnvoi).getTime() < DELAI_SUPPRESSION_MS
    );
  });

  // Toucher la bulle (téléphone) : montre / cache le bouton 🗑
  basculer() {
    if (this.peutMasquer()) this.ouvert.update((v) => !v);
  }

  demander() {
    this.erreur.set('');
    this.confirmation.set(true);
  }

  annuler() {
    this.confirmation.set(false);
    this.ouvert.set(false);
  }

  // « Supprimer pour moi »
  masquer() {
    if (this.busy()) return;
    this.busy.set(true);
    this.erreur.set('');
    this.api.masquerPourMoi(this.message().id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmation.set(false);
        this.ouvert.set(false);
        this.masque.emit(this.message().id);
      },
      error: (error) => {
        this.busy.set(false);
        this.erreur.set(apiError(error));
      },
    });
  }

  // « Supprimer pour tout le monde »
  supprimer() {
    if (this.busy()) return;
    this.busy.set(true);
    this.erreur.set('');
    this.api.supprimer(this.message().id).subscribe({
      next: (message) => {
        this.busy.set(false);
        this.confirmation.set(false);
        this.ouvert.set(false);
        this.modifie.emit(message);
      },
      error: (error) => {
        this.busy.set(false);
        this.erreur.set(apiError(error));
      },
    });
  }
}
