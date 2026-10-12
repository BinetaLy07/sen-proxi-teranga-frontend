import {
  afterNextRender,
  Component,
  ElementRef,
  input,
  output,
  effect,
  OnDestroy,
  viewChild,
  signal,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { PositionGps } from './geolocalisation.service';

export interface PointCarte extends PositionGps {
  id: number;
  titre: string;
}

@Component({
  selector: 'app-carte',
  template: `<div
      #carte
      class="relative z-0 h-80 w-full rounded-xl border border-gray-200 sm:h-96"
      role="region"
      aria-label="Carte interactive : cliquez pour choisir une position"
    ></div>
    @if (erreur()) {
      <p class="notice error" role="alert">{{ erreur() }}</p>
    }`,
})
export class Carte implements OnDestroy {
  readonly position = input<PositionGps | null>(null);
  readonly points = input<PointCarte[]>([]);
  readonly selection = output<PositionGps>();
  readonly ouvrir = output<number>();
  private readonly element = viewChild.required<ElementRef<HTMLDivElement>>('carte');
  private map?: Leaflet.Map;
  private groupe?: Leaflet.LayerGroup;
  private leaflet?: typeof Leaflet;
  private observer?: ResizeObserver;
  private destroyed = false;
  readonly erreur = signal('');

  constructor() {
    afterNextRender(() => void this.initialiser());
    effect(() => {
      const position = this.position();
      const points = this.points();
      this.afficher(position, points);
    });
  }

  private async initialiser() {
    try {
      const module = await import('leaflet');
      // Leaflet 1.x est CommonJS : le build de production expose l'API dans default.
      const l = module.default ?? module;
      if (this.destroyed) return;
      this.leaflet = l;
      this.map = l
        .map(this.element().nativeElement, { scrollWheelZoom: false })
        .setView([14.7167, -17.4677], 11);
      l.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.groupe = l.layerGroup().addTo(this.map);
      this.map.on('click', (e: Leaflet.LeafletMouseEvent) =>
        this.selection.emit({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        }),
      );
      this.observer = new ResizeObserver(() => this.map?.invalidateSize());
      this.observer.observe(this.element().nativeElement);
      this.afficher(this.position(), this.points());
    } catch {
      this.erreur.set('Impossible de charger la carte. Réessayez avec une connexion Internet.');
    }
  }

  private afficher(position: PositionGps | null, points: PointCarte[]) {
    const l = this.leaflet;
    if (!this.map || !this.groupe || !l) return;
    this.groupe.clearLayers();
    const limites: Leaflet.LatLngTuple[] = [];
    if (position) {
      const p: Leaflet.LatLngTuple = [position.latitude, position.longitude];
      limites.push(p);
      const texte = document.createElement('span');
      texte.textContent = 'Position sélectionnée';
      l.circleMarker(p, { radius: 9, color: '#2563eb', fillOpacity: 1, bubblingMouseEvents: false })
        .bindTooltip(texte)
        .addTo(this.groupe);
    }
    for (const point of points) {
      const p: Leaflet.LatLngTuple = [point.latitude, point.longitude];
      limites.push(p);
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.textContent = `${point.titre} — Voir le profil`;
      bouton.className = 'text-link font-semibold';
      bouton.addEventListener('click', () => this.ouvrir.emit(point.id));
      l.circleMarker(p, {
        radius: 10,
        color: '#047857',
        fillOpacity: 0.9,
        bubblingMouseEvents: false,
      })
        .bindPopup(bouton)
        .addTo(this.groupe);
    }
    if (limites.length === 1) this.map.setView(limites[0], 14);
    else if (limites.length > 1)
      this.map.fitBounds(l.latLngBounds(limites), { padding: [30, 30], maxZoom: 15 });
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    this.map?.remove();
  }
}
