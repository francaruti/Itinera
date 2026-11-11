import { dowIndex, formatTime12, normalizeTime, timeToMinutes } from '../../../shared/time';
import type { CatalogPlace, Hours } from '../../../shared/catalog';
import type { Activity, ActivityCategory, Snapshot } from '../../../shared/types';
import { cityMeta } from '../../../shared/constants';

/* ------------------------------ Horarios ------------------------------ */

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DowKey = (typeof DOW_KEYS)[number];
const dowKey = (date: string): DowKey => DOW_KEYS[dowIndex(date)];
const prevDowKey = (date: string): DowKey => DOW_KEYS[(dowIndex(date) + 6) % 7];

export interface OpenState {
  state: 'open' | 'closed' | 'unknown';
  /** Texto corto para mostrar: "Abierto · cierra 10 pm", "Abre 10 am", "Cerrado ese día". */
  label: string;
}

const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (mins: number) => formatTime12(`${String(Math.floor((mins % 1440) / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);

/** ¿Está abierto un lugar ese día a esa hora? Maneja cierres después de medianoche (p. ej. "26:00"). */
export function openStatus(place: Pick<CatalogPlace, 'hours'>, date: string, time: string): OpenState {
  const h: Hours | null | undefined = place.hours;
  const t = normalizeTime(time);
  if (!h || !t) return { state: 'unknown', label: 'Horario por confirmar' };
  const today = h[dowKey(date)];
  const yesterday = h[prevDowKey(date)];
  const now = m(t);

  // Horario de ayer que se extiende pasada la medianoche.
  if (yesterday && m(yesterday[1]) > 1440 && now <= m(yesterday[1]) - 1440) {
    return { state: 'open', label: `Abierto · cierra ${fmt(m(yesterday[1]))}` };
  }
  if (today === undefined) return { state: 'unknown', label: 'Horario por confirmar' };
  if (today === null) return { state: 'closed', label: 'Cerrado ese día' };
  const [open, close] = [m(today[0]), m(today[1])];
  if (now >= open && now < close) return { state: 'open', label: `Abierto · cierra ${fmt(close)}` };
  if (now < open) return { state: 'closed', label: `Abre ${fmt(open)}` };
  return { state: 'closed', label: 'Ya cerrado a esa hora' };
}

/* ------------------------------ Distancias ------------------------------ */

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Minutos a pie (≈ 4,5 km/h con rodeo urbano). */
export const walkMinutes = (km: number) => Math.max(1, Math.round((km * 1.3 * 1000) / 75));

export function travelLabel(km: number): string {
  const walk = walkMinutes(km);
  if (walk <= 25) return `${walk} min a pie`;
  return `~${Math.round(8 + km * 2.6)} min en metro o auto`;
}

/* ------------------------------ Catálogo ↔ actividades ------------------------------ */

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface CatalogIndex {
  byId: Map<string, CatalogPlace>;
  names: Array<{ key: string; place: CatalogPlace }>;
}

export function indexCatalog(catalog: CatalogPlace[]): CatalogIndex {
  const names: CatalogIndex['names'] = [];
  for (const p of catalog) for (const n of [p.name, ...(p.aliases ?? [])]) if (norm(n)) names.push({ key: norm(n), place: p });
  return { byId: new Map(catalog.map((p) => [p.id, p])), names };
}

/** Encuentra el lugar del catálogo que corresponde a una actividad (por su campo "lugar" o por su texto). */
export function catalogFor(a: Pick<Activity, 'place' | 'text'>, idx: CatalogIndex): CatalogPlace | null {
  const place = norm(a.place);
  if (place) {
    const exact = idx.names.find((n) => n.key === place);
    if (exact) return exact.place;
  }
  const text = norm(a.text);
  // El nombre más largo que aparezca en el texto gana (evita que "Joe" gane a "Joe's Pizza Broadway").
  let best: { key: string; place: CatalogPlace } | null = null;
  for (const n of idx.names) if (n.key.length >= 6 && (text.includes(n.key) || (place && place.includes(n.key))) && (!best || n.key.length > best.key.length)) best = n;
  return best?.place ?? null;
}

/* ------------------------------ Duraciones y reacomodo ------------------------------ */

const DEFAULT_MINUTES: Record<ActivityCategory, number> = {
  sight: 75,
  food: 60,
  transport: 60,
  lodging: 30,
  park: 180,
  shopping: 75,
  show: 150,
  rest: 60,
  other: 45,
};

export function durationOf(a: Activity, idx: CatalogIndex): number {
  return catalogFor(a, idx)?.minutes ?? DEFAULT_MINUTES[a.category];
}

const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;
const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export interface TimeShift {
  id: string;
  from: string;
  to: string;
}

/**
 * Tras cambiar una actividad, empuja hacia adelante las siguientes con hora que ahora se traslapan.
 * Nunca adelanta horarios ni toca actividades sin hora.
 */
export function retime(dayActs: Activity[], changedId: string, idx: CatalogIndex, bufferMin = 15): TimeShift[] {
  const ordered = [...dayActs].sort((a, b) => a.position - b.position);
  const i = ordered.findIndex((a) => a.id === changedId);
  if (i < 0 || !ordered[i].time) return [];
  const shifts: TimeShift[] = [];
  let endPrev = timeToMinutes(ordered[i].time) + durationOf(ordered[i], idx);
  for (let k = i + 1; k < ordered.length; k++) {
    const b = ordered[k];
    if (!b.time) continue;
    const start = timeToMinutes(b.time);
    const required = roundUp5(endPrev + bufferMin);
    if (start < required && required < 24 * 60) {
      shifts.push({ id: b.id, from: b.time, to: toTime(required) });
      endPrev = required + durationOf(b, idx);
    } else {
      break; // ya hay holgura: el resto del día queda igual
    }
  }
  return shifts;
}

/* ------------------------------ Alternativas ------------------------------ */

export interface Alternative {
  place: CatalogPlace;
  km: number;
  travel: string;
  open: OpenState;
  score: number;
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const mealOf = (time: string): MealSlot => {
  const t = time ? timeToMinutes(time) : 13 * 60;
  return t < 11 * 60 ? 'breakfast' : t < 17 * 60 ? 'lunch' : 'dinner';
};
const FOOD_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'dessert']);

/** Punto de referencia: la actividad anterior con ubicación (así "cerca" significa cerca de donde vienes). */
function anchorFor(a: Activity, ordered: Activity[], city: string) {
  const i = ordered.findIndex((x) => x.id === a.id);
  for (let k = i - 1; k >= 0; k--) if (ordered[k].lat != null && ordered[k].lng != null) return { lat: ordered[k].lat!, lng: ordered[k].lng! };
  if (a.lat != null && a.lng != null) return { lat: a.lat, lng: a.lng };
  return { lat: cityMeta(city).lat, lng: cityMeta(city).lng };
}

/** Las 3 mejores alternativas para una actividad: mismo tipo de plan, abiertas a esa hora, cercanas y bien calificadas. */
export function alternativesFor(a: Activity, snap: Snapshot, catalog: CatalogPlace[], idx: CatalogIndex, limit = 3): Alternative[] {
  const day = snap.days.find((d) => d.date === a.dayDate);
  if (!day) return [];
  const current = catalogFor(a, idx);
  const ordered = snap.activities.filter((x) => x.dayDate === a.dayDate).sort((x, y) => x.position - y.position);
  const anchor = anchorFor(a, ordered, day.city);

  const used = new Set<string>();
  for (const x of snap.activities) {
    if (x.id === a.id) continue;
    const c = catalogFor(x, idx);
    if (c) used.add(c.id);
  }

  const isFood = current ? current.category === 'food' : a.category === 'food';
  const meal = current && FOOD_SLOTS.has(current.slot) ? (current.slot === 'dessert' ? 'snack' : (current.slot as MealSlot)) : mealOf(a.time);
  const time = a.time || (isFood ? (meal === 'breakfast' ? '09:00' : meal === 'lunch' ? '13:00' : '19:30') : '11:00');

  const out: Alternative[] = [];
  for (const p of catalog) {
    if (p.city !== day.city || p.id === current?.id || used.has(p.id)) continue;
    if (isFood) {
      if (p.category !== 'food') continue;
      // Dulces y snacks solo sustituyen a dulces y snacks; las comidas fuertes se intercambian entre sí.
      const pMeal = p.slot === 'dessert' ? 'snack' : p.slot;
      const wantsSnack = meal === 'snack';
      const isSnack = pMeal === 'snack';
      if (wantsSnack !== isSnack) continue;
      // El desayuno solo se cambia por otro desayuno (o lugares "any"); almuerzo y cena sí son intercambiables.
      if (!wantsSnack && (pMeal === 'breakfast') !== (meal === 'breakfast') && pMeal !== 'any') continue;
    } else {
      if (current?.park && p.park !== current.park) continue;
      if (current && current.slot !== 'any' && p.slot !== current.slot) continue;
      if (!current && p.category !== a.category) continue;
      if (p.category === 'food') continue;
    }
    const open = openStatus(p, a.dayDate, time);
    if (open.state === 'closed') continue;
    const km = distanceKm(anchor, p);
    const wait = p.waitMinutes?.typical ?? 0;
    const score = (p.rating ?? 4) * 10 - km * 8 - wait / 15 + (open.state === 'open' ? 3 : 0) - (p.confidence === 'baja' ? 2 : 0);
    out.push({ place: p, km, travel: travelLabel(km), open, score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Texto de la actividad al elegir un lugar nuevo (conserva el momento: "Almuerzo en …"). */
export function textFor(place: CatalogPlace): string {
  switch (place.slot) {
    case 'breakfast':
      return `Desayuno en ${place.name}`;
    case 'lunch':
      return `Almuerzo en ${place.name}`;
    case 'dinner':
      return `Cena en ${place.name}`;
    case 'snack':
    case 'dessert':
      return `Antojo en ${place.name}`;
    default:
      return place.name;
  }
}
