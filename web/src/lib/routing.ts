import { api } from './api';
import { estimate, flightEstimate, kmBetween, type LatLng, type TravelMode } from './geo';

export interface ModeRoute {
  mode: TravelMode;
  /** Metros */
  distance: number;
  /** Segundos */
  duration: number;
  geometry?: Array<[number, number]>;
  /** Estimación (sin ruta real): sin conexión o servicio no disponible */
  approx?: boolean;
  /** Solo avión: demasiado cerca para volar */
  tooShort?: boolean;
}
export type RouteSet = Record<TravelMode, ModeRoute | null> & { km: number; offline: boolean };

const cache = new Map<string, { at: number; set: RouteSet }>();
const key = (a: LatLng, b: LatLng) => `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

/** Tiempos a pie, en bici, en carro y en avión entre dos puntos. Si no hay red, se estiman en el dispositivo. */
export async function computeRoutes(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteSet> {
  const k = key(from, to);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.set;

  const km = kmBetween(from, to);
  const f = flightEstimate(km);
  const plane: ModeRoute = { mode: 'plane', distance: f.distance, duration: f.duration, geometry: [[from.lat, from.lng], [to.lat, to.lng]], tooShort: f.tooShort };
  let offline = false;
  let land: Awaited<ReturnType<typeof api.routes>> | null = null;
  try {
    land = await api.routes(from, to, signal);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    offline = true;
  }
  const modes = ['foot', 'bike', 'car'] as const;
  const out = { plane, km, offline } as RouteSet;
  for (const m of modes) {
    const r = land?.[m];
    if (r) out[m] = { mode: m, distance: r.distance, duration: r.duration, geometry: r.geometry };
    else if (offline && km < 400) out[m] = { mode: m, ...estimate(m, km), approx: true };
    else out[m] = null; // sin ruta por tierra (otro continente, al otro lado del mar…)
  }
  cache.set(k, { at: Date.now(), set: out });
  if (cache.size > 100) cache.clear();
  return out;
}

/** El mejor modo por defecto según la distancia. */
export function defaultMode(set: RouteSet): TravelMode {
  if (set.km > 500 && set.plane) return 'plane';
  if (set.foot && set.foot.duration <= 25 * 60) return 'foot';
  if (set.car) return set.bike && set.bike.duration < 20 * 60 && set.km < 6 ? 'bike' : 'car';
  if (set.bike) return 'bike';
  if (set.foot) return 'foot';
  return 'plane';
}
