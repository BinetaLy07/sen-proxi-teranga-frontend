// Les 3 niveaux : Région > Commune > Quartier
export type TypeZone = 'REGION' | 'COMMUNE' | 'QUARTIER';

// Une zone (backend : ZoneResponse)
export interface Zone {
  id: number;
  nom: string;
  type: TypeZone;
  latitude: number | null;
  longitude: number | null;
  regionId: number | null;
  regionNom: string | null;
  communeId: number | null;
  communeNom: string | null;
}
