import type { Activity, City, Day, Reservation } from '../../../shared/types';
import manifest from '../../../shared/photos.json';

export interface PhotoInfo {
  key: string;
  name: string;
  city: City;
  file: string;
  path: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string;
  page: string;
}

export const PHOTOS: Record<string, PhotoInfo> = Object.fromEntries(
  Object.entries(manifest as Record<string, Omit<PhotoInfo, 'key'>>).map(([key, p]) => [key, { key, ...p }]),
) as Record<string, PhotoInfo>;

/** Anchos estándar de miniaturas de Wikimedia (otros valores pueden ser rechazados). */
export type PhotoWidth = 500 | 960 | 1280 | 1920;
const STEPS: PhotoWidth[] = [500, 960, 1280, 1920];

export function photoUrl(p: PhotoInfo, width: PhotoWidth = 960): string {
  const w = [...STEPS].reverse().find((s) => s <= width && s <= p.width) ?? (STEPS.find((s) => s <= p.width) ?? 500);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${p.path}/${encodeURIComponent(p.file)}/${w}px-${encodeURIComponent(p.file)}`;
}

export const photo = (key: string | null | undefined): PhotoInfo | null => (key ? (PHOTOS[key] ?? null) : null);

/**
 * Reglas (en orden de prioridad) que asocian un texto libre con una foto de `shared/photos.json`.
 * Ejemplo: [/museo de arte/i, 'museo-arte']. La plantilla no trae fotos: agrega las tuyas aquí.
 */
const RULES: Array<[RegExp, string]> = [];

/** Foto de portada de cada ciudad (clave de `shared/photos.json`), opcional. */
const CITY_PHOTO: Partial<Record<City, string>> = {};

export function photoKeyFor(...texts: Array<string | undefined>): string | null {
  const hay = texts.filter(Boolean).join(' · ');
  if (!hay) return null;
  for (const [re, key] of RULES) if (re.test(hay) && PHOTOS[key]) return key;
  return null;
}

/** El lugar en sí (campo "lugar") pesa más que el texto largo de la actividad. */
export const photoForActivity = (a: Pick<Activity, 'place' | 'text'>): PhotoInfo | null => photo(photoKeyFor(a.place) ?? photoKeyFor(a.text));

export function photoForReservation(r: Reservation): PhotoInfo | null {
  if (r.kind === 'flight') return null;
  return photo(photoKeyFor(r.title, r.address));
}

export const cityPhoto = (city: City): PhotoInfo | null => photo(CITY_PHOTO[city]);

/** Qué tan "icónica" es cada foto para elegir la portada de un día (por defecto 5). Ejemplo: { 'museo-arte': 7 }. */
const COVER_WEIGHT: Record<string, number> = {};

export function coverFor(day: Pick<Day, 'city'>, acts: Activity[]): PhotoInfo | null {
  let best: { p: PhotoInfo; w: number } | null = null;
  for (const a of acts) {
    const p = photoForActivity(a);
    if (!p) continue;
    const w = COVER_WEIGHT[p.key] ?? 5;
    if (!best || w > best.w) best = { p, w };
  }
  return best?.p ?? cityPhoto(day.city);
}

/** Autor sin ruido para mostrarlo en una etiqueta corta. */
export function shortAuthor(p: PhotoInfo): string {
  const a = p.author.replace(/^(photograph|photo|image|picture)\s+(by|of)\s+/i, '').replace(/\s*\(.*$/, '').trim();
  return a.length > 26 ? `${a.slice(0, 25)}…` : a || 'Wikimedia';
}
