// « Bonjour » ou « Bonsoir » selon l'heure de l'appareil de l'utilisateur :
// - de 5 h à 17 h 59 : « Bonjour »
// - à partir de 18 h (et la nuit, jusqu'à 4 h 59) : « Bonsoir »
export function salutation(maintenant: Date = new Date()): 'Bonjour' | 'Bonsoir' {
  const heure = maintenant.getHours();
  return heure >= 5 && heure < 18 ? 'Bonjour' : 'Bonsoir';
}
