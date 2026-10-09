import { Component, output } from '@angular/core';

// La grille d'emojis qui s'ouvre au-dessus de la barre de saisie (bouton 😊).
// En haut : les emojis les plus utiles pour la plateforme (pratiques pour ceux qui lisent peu).
// Un clic sur un emoji le « choisit » : la barre l'ajoute dans le texte.
@Component({
  selector: 'app-choix-emoji',
  templateUrl: './choix-emoji.html',
})
export class ChoixEmoji {
  readonly choisi = output<string>();

  readonly groupes = [
    {
      titre: 'Les plus utiles',
      emojis: ['👍', '🙏', '😊', '✅', '❌', '📅', '⏰', '🔧', '💰', '📍', '🏠', '📞'],
    },
    {
      titre: 'Visages et gestes',
      emojis: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😅',
        '😂',
        '🙂',
        '😉',
        '😍',
        '🥰',
        '😘',
        '😎',
        '🤔',
        '😐',
        '😮',
        '😢',
        '😭',
        '😡',
        '😴',
        '🤲',
        '👏',
        '🙌',
        '💪',
        '👋',
        '👌',
        '❤️',
        '💯',
        '🔥',
        '🎉',
        '⭐',
      ],
    },
  ];
}
