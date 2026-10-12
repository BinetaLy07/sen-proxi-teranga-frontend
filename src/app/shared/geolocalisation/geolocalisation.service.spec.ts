import { GeolocalisationService } from './geolocalisation.service';

describe('GPS du navigateur', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('demande la position seulement sur appel et conserve les coordonnées zéro', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: 0, longitude: 0 },
      } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const gps = new GeolocalisationService();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await expect(gps.localiser()).resolves.toEqual({ latitude: 0, longitude: 0 });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it('propose de choisir un point quand la permission est refusée', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
      },
    });
    await expect(new GeolocalisationService().localiser()).rejects.toThrow('Autorisation refusée');
  });

  it('gère un navigateur sans géolocalisation', async () => {
    vi.stubGlobal('navigator', {});
    await expect(new GeolocalisationService().localiser()).rejects.toThrow('Choisissez');
  });
});
