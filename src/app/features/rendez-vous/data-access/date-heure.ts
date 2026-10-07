import { ValidatorFn } from '@angular/forms';

// Petits outils pour le champ « date et heure » du navigateur (<input type="datetime-local">).
// Ce champ utilise le format "2026-10-10T09:00" (sans les secondes).

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

// La date et l'heure actuelles, au format du champ : "2026-10-07T18:25"
export function maintenantLocal() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}` +
    `T${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`
  );
}

// La date proposée par défaut au client : le jour qu'il avait souhaité dans sa demande, à 9 h.
// Si ce moment est déjà passé, le champ reste vide.
export function dateParDefaut(dateSouhaitee: string | null | undefined) {
  if (!dateSouhaitee) return '';
  const proposition = `${dateSouhaitee}T09:00`;
  return proposition > maintenantLocal() ? proposition : '';
}

// Validateur : la date choisie doit être dans le futur.
// (Les deux textes ont le même format, on peut donc les comparer directement.)
export const dateFuture: ValidatorFn = (champ) =>
  champ.value && champ.value <= maintenantLocal() ? { datePassee: true } : null;
