/** Rutas a pie, en bicicleta y en carro con el servicio público de enrutamiento de OpenStreetMap (FOSSGIS). */
export type Mode = 'foot' | 'bike' | 'car';
export const MODES: Mode[] = ['foot', 'bike', 'car'];

export interface RouteResult {
  /** Metros */
  distance: number;
  /** Segundos */
  duration: number;
  /** [lat, lng] simplificados para dibujar la ruta */
  geometry: Array<[number, number]>;
}
export type Routes = Record<Mode, RouteResult | null>;

const HOST: Record<Mode, string> = { foot: 'routed-foot', bike: 'routed-bike', car: 'routed-car' };
const cache = new Map<string, { at: number; value: RouteResult | null }>();
const TTL = 10 * 60_000;

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export async function route(mode: Mode, from: [number, number], to: [number, number]): Promise<RouteResult | null> {
  const key = `${mode}|${r4(from[0])},${r4(from[1])}|${r4(to[0])},${r4(to[1])}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const url = `https://routing.openstreetmap.de/${HOST[mode]}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=simplified&geometries=geojson&steps=false`;
  let value: RouteResult | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'viajes-planificador/1.0 (uso personal)' }, signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const json = (await res.json()) as { code?: string; routes?: Array<{ distance: number; duration: number; geometry?: { coordinates: Array<[number, number]> } }> };
      const r = json.code === 'Ok' ? json.routes?.[0] : undefined;
      if (r && Number.isFinite(r.distance) && Number.isFinite(r.duration)) {
        value = { distance: r.distance, duration: r.duration, geometry: (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]) };
      }
    } else if (res.status >= 500 || res.status === 429) {
      return null; // falla temporal: no se guarda en caché
    }
  } catch {
    return null;
  }
  if (cache.size > 800) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function routes(from: [number, number], to: [number, number]): Promise<Routes> {
  const [foot, bike, car] = await Promise.all(MODES.map((m) => route(m, from, to)));
  return { foot, bike, car };
}

export interface WalkResult {
  distance: number;
  duration: number;
  /** [lat, lng] de todo el recorrido a pie */
  geometry: Array<[number, number]>;
  /** Un tramo por cada par de paradas consecutivas */
  legs: Array<{ distance: number; duration: number }>;
}

const walkCache = new Map<string, { at: number; value: WalkResult | null }>();

/** Recorrido a pie por varias paradas seguidas (una sola consulta; máximo 20 puntos). */
export async function walk(points: Array<[number, number]>): Promise<WalkResult | null> {
  if (points.length < 2 || points.length > 20) return null;
  const key = points.map((p) => `${r4(p[0])},${r4(p[1])}`).join(';');
  const hit = walkCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const coords = points.map((p) => `${p[1]},${p[0]}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  let value: WalkResult | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'viajes-planificador/1.0 (uso personal)' }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const json = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number; geometry?: { coordinates: Array<[number, number]> }; legs?: Array<{ distance: number; duration: number }> }>;
      };
      const r = json.code === 'Ok' ? json.routes?.[0] : undefined;
      if (r && r.legs?.length === points.length - 1) {
        value = {
          distance: r.distance,
          duration: r.duration,
          geometry: (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
          legs: r.legs.map((l) => ({ distance: l.distance, duration: l.duration })),
        };
      }
    } else if (res.status >= 500 || res.status === 429) return null;
  } catch {
    return null;
  }
  if (walkCache.size > 300) walkCache.clear();
  walkCache.set(key, { at: Date.now(), value });
  return value;
}
