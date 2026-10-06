// Petites aides pour afficher une date de rendez-vous « à la française »,
// sans dépendre de la langue configurée dans Angular.

const MOIS = [
  'JANV.',
  'FÉVR.',
  'MARS',
  'AVR.',
  'MAI',
  'JUIN',
  'JUIL.',
  'AOÛT',
  'SEPT.',
  'OCT.',
  'NOV.',
  'DÉC.',
];

// "2026-10-08T10:00:00" -> { jour: "08", mois: "OCT." }
export function jourMois(dateIso: string) {
  const d = new Date(dateIso);
  return { jour: String(d.getDate()).padStart(2, '0'), mois: MOIS[d.getMonth()] };
}

// "2026-10-08T10:00:00" -> "10h00"
export function heure(dateIso: string) {
  const d = new Date(dateIso);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

// La date est-elle aujourd'hui ou plus tard ?
export function aVenir(dateIso: string) {
  const debutDuJour = new Date();
  debutDuJour.setHours(0, 0, 0, 0);
  return new Date(dateIso).getTime() >= debutDuJour.getTime();
}
