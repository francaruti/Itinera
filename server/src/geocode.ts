import { cityMeta } from '../../shared/constants';
import type { City, GeocodeResult } from '../../shared/types';

const cache = new Map<string, GeocodeResult[]>();
let lastCall = 0;

interface Nominatim {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  class?: string;
  type?: string;
  category?: string;
  address?: Record<string, string>;
}

function shortAddress(a: Record<string, string> | undefined, display: string): string {
  if (!a) return display.split(',').slice(1, 4).join(',').trim();
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const area = a.neighbourhood || a.suburb || a.borough;
  const city = a.city || a.town || a.village || a.municipality || a.county;
  return [street, area, city, a.state].filter(Boolean).join(', ');
}

/** Búsqueda de lugares con Nominatim (OpenStreetMap). Prefiere resultados cerca de `near`, respeta 1 consulta por segundo y cachea. */
export async function geocode(query: string, near?: City, around?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  const key = `${query.trim().toLowerCase()}|${near ?? ''}|${around ? `${around.lat.toFixed(2)},${around.lng.toFixed(2)}` : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const params: Record<string, string> = {
    q: query,
    format: 'jsonv2',
    limit: '8',
    addressdetails: '1',
    namedetails: '0',
    dedupe: '1',
    'accept-language': 'en-US,en;q=0.9,es;q=0.5',
  };
  if (around) {
    // «Cerca de mí»: solo lo que cae dentro de ~5 km alrededor del punto
    const d = 0.05;
    params.viewbox = `${around.lng - d},${around.lat + d},${around.lng + d},${around.lat - d}`;
    params.bounded = '1';
    params.limit = '12';
  } else if (near) {
    const { lat, lng } = cityMeta(near);
    const d = 0.5;
    // Preferencia suave (bounded=0): los resultados cercanos suben, pero no se excluyen los demás.
    params.viewbox = `${lng - d},${lat + d},${lng + d},${lat - d}`;
    params.bounded = '0';
  }
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'viajes-planificador/1.0 (uso personal)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const json = (await res.json()) as Nominatim[];
  const results: GeocodeResult[] = json.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    name: r.name || r.display_name.split(',')[0].trim(),
    address: shortAddress(r.address, r.display_name),
    osm: r.category && r.type ? `${r.category}/${r.type}` : r.class && r.type ? `${r.class}/${r.type}` : undefined,
  }));
  if (cache.size > 500) cache.clear();
  cache.set(key, results);
  return results;
}
