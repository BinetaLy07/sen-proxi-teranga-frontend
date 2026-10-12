import { Injectable } from '@angular/core';

export interface PositionGps {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class GeolocalisationService {
  localiser(): Promise<PositionGps> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('La géolocalisation est indisponible. Choisissez un point sur la carte.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        (error) =>
          reject(
            new Error(
              error.code === 1
                ? 'Autorisation refusée. Autorisez la localisation ou choisissez un point sur la carte.'
                : 'Position indisponible. Réessayez ou choisissez un point sur la carte.',
            ),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }
}
