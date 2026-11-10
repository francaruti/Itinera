/** Utilidades de fecha/hora sin dependencias, válidas en Node y navegador. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Normaliza "5:20" → "05:20". Devuelve '' si no es una hora válida. */
export function normalizeTime(raw: string): string {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(raw ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return '';
  return `${pad(h)}:${pad(min)}`;
}

/** Minutos desde medianoche; los vacíos van al final. */
export function timeToMinutes(t: string): number {
  const n = normalizeTime(t);
  if (!n) return 24 * 60 + 1;
  const [h, m] = n.split(':').map(Number);
  return h * 60 + m;
}

/** "13:30" → "1:30 pm" */
export function formatTime12(t: string): string {
  const n = normalizeTime(t);
  if (!n) return '';
  const [h, m] = n.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** Offset (en minutos) de una zona horaria en un instante dado. */
function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Convierte una fecha+hora locales de `timeZone` en un instante UTC (ms). */
export function zonedToUtcMs(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (normalizeTime(time) || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas para resolver correctamente cambios de horario.
  let ms = guess - tzOffsetMinutes(guess, timeZone) * 60000;
  ms = guess - tzOffsetMinutes(ms, timeZone) * 60000;
  return ms;
}

/** Fecha (YYYY-MM-DD) y hora (HH:mm) actuales en `timeZone`. */
export function nowInZone(timeZone: string, now = Date.now()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dayDiff(a: string, b: string): number {
  const toMs = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(b) - toMs(a)) / 86400000);
}

export const DOW_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function dowIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}
export function monthIndex(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}
export function longDate(date: string): string {
  return `${DOW_ES[dowIndex(date)]} ${dayOfMonth(date)} de ${MONTH_ES[monthIndex(date)]}`;
}

/** Rango corto para cabeceras: «5 – 15 oct 2026», «30 sep – 4 oct 2026» o «1 ene 2027 – 3 ene 2027». */
export function rangoCorto(start: string, end: string): string {
  if (!start || !end) return '';
  const mes = (d: string) => MONTH_ES[monthIndex(d)].slice(0, 3);
  const anio = (d: string) => d.slice(0, 4);
  if (start === end) return `${dayOfMonth(start)} ${mes(start)} ${anio(start)}`;
  if (anio(start) !== anio(end)) return `${dayOfMonth(start)} ${mes(start)} ${anio(start)} – ${dayOfMonth(end)} ${mes(end)} ${anio(end)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${dayOfMonth(start)} – ${dayOfMonth(end)} ${mes(end)} ${anio(end)}`;
  return `${dayOfMonth(start)} ${mes(start)} – ${dayOfMonth(end)} ${mes(end)} ${anio(end)}`;
}
