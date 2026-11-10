import { api } from './api';
import { estimate, kmBetween, type LatLng } from './geo';

/** Más lejos que esto entre dos paradas seguidas ya no se camina: se sugiere otro medio. */
export const MAX_WALK_KM = 4;

export interface WalkStop extends LatLng {
  id: string;
}
export interface Leg {
  from: string;
  to: string;
  /** Metros y segundos */
  distance: number;
  duration: number;
  mode: 'foot' | 'car';
  /** Sin ruta real (sin conexión o servicio caído) */
  approx: boolean;
}
export interface WalkPlan {
  /** Trazados a pie (cada uno cubre varias paradas seguidas) */
  lines: Array<{ geometry: Array<[number, number]>; approx: boolean }>;
  /** Tramos entre paradas consecutivas, en el orden del día */
  legs: Leg[];
}

/** Agrupa paradas seguidas que se pueden caminar; un salto largo corta la cadena. */
export function splitChains(stops: WalkStop[]): WalkStop[][] {
  const chains: WalkStop[][] = [];
  let cur: WalkStop[] = [];
  for (const s of stops) {
    const prev = cur[cur.length - 1];
    if (prev && kmBetween(prev, s) > MAX_WALK_KM) {
      if (cur.length > 1) chains.push(cur);
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length > 1) chains.push(cur);
  // el servidor admite hasta 20 puntos por consulta
  return chains.flatMap((c) => (c.length <= 20 ? [c] : [c.slice(0, 20), c.slice(19)]));
}

const cache = new Map<string, { at: number; plan: WalkPlan }>();

/** Rutas a pie reales entre las paradas del día (OpenStreetMap). Los saltos largos se estiman en carro. */
export async function planWalk(stops: WalkStop[], signal?: AbortSignal): Promise<WalkPlan> {
  const key = stops.map((s) => `${s.id}:${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.plan;

  const legs = new Map<string, Leg>();
  const lines: WalkPlan['lines'] = [];
  const chains = splitChains(stops);
  await Promise.all(
    chains.map(async (chain) => {
      try {
        const w = await api.walk(chain, signal);
        lines.push({ geometry: w.geometry, approx: false });
        w.legs.forEach((l, i) => legs.set(`${chain[i].id}>${chain[i + 1].id}`, { from: chain[i].id, to: chain[i + 1].id, distance: l.distance, duration: l.duration, mode: 'foot', approx: false }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lines.push({ geometry: chain.map((c) => [c.lat, c.lng] as [number, number]), approx: true });
      }
    }),
  );
  // Tramos sin ruta real: estimación (a pie si es cerca, en carro si es lejos)
  const out: Leg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const k = `${a.id}>${b.id}`;
    const real = legs.get(k);
    if (real) out.push(real);
    else {
      const km = kmBetween(a, b);
      const mode = km > MAX_WALK_KM ? 'car' : 'foot';
      out.push({ from: a.id, to: b.id, mode, approx: true, ...estimate(mode, km) });
    }
  }
  const plan = { lines, legs: out };
  cache.set(key, { at: Date.now(), plan });
  if (cache.size > 50) cache.clear();
  return plan;
}

/** Tramos estimados al instante (mientras llegan las rutas reales o si no hay conexión). */
export function estimateLegs(stops: WalkStop[]): Leg[] {
  const out: Leg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const km = kmBetween(stops[i], stops[i + 1]);
    const mode = km > MAX_WALK_KM ? 'car' : 'foot';
    out.push({ from: stops[i].id, to: stops[i + 1].id, mode, approx: true, ...estimate(mode, km) });
  }
  return out;
}
