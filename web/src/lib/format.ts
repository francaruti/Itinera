/** Importes en dólares (USD), la única moneda de la app. */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const money = (amount: number) => usd.format(amount);

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function mapsSearchUrl(place: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    ?.writeText(text)
    .then(() => true)
    .catch(() => false) ?? Promise.resolve(false);
}

/** "14:30 Almuerzo" / "2pm Cena" → { time, text }. */
export function parseQuickAdd(input: string): { time: string; text: string } {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?\s+(.+)$/i.exec(input);
  if (!m) return { time: '', text: input.trim() };
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const mer = (m[3] ?? '').toLowerCase().replace(/[.\s]/g, '');
  const hasColon = m[2] !== undefined;
  if (!mer && !hasColon) return { time: '', text: input.trim() };
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return { time: '', text: input.trim() };
  return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, text: m[4].trim() };
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
