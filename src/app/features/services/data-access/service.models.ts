import { TypeTarif } from '../../professionnels/data-access/professionnel.models';

// Les 3 façons de fixer un prix
export const TYPES_TARIF: { valeur: TypeTarif; libelle: string }[] = [
  { valeur: 'FIXE', libelle: 'Prix fixe' },
  { valeur: 'A_PARTIR_DE', libelle: 'À partir de' },
  { valeur: 'SUR_DEVIS', libelle: 'Sur devis' },
];

// Ce que le pro envoie pour créer ou modifier un service (backend : ServiceRequest)
export interface ServiceSaisie {
  titre: string;
  description: string | null;
  typeTarif: TypeTarif;
  montant: number | null; // obligatoire pour FIXE et A_PARTIR_DE, vide pour SUR_DEVIS
  categorieId: number;
}
