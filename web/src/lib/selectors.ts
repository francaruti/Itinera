import { nowInZone, timeToMinutes } from '../../../shared/time';
import type { Activity, Day, Snapshot } from '../../../shared/types';

export function dayActivities(snap: Snapshot, date: string): Activity[] {
  return snap.activities.filter((a) => a.dayDate === date).sort((a, b) => a.position - b.position);
}

export interface DayStat {
  total: number;
  done: number;
  cost: number;
}
export function dayStats(snap: Snapshot): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const d of snap.days) map.set(d.date, { total: 0, done: 0, cost: 0 });
  for (const a of snap.activities) {
    const s = map.get(a.dayDate);
    if (!s) continue;
    s.total++;
    if (a.done) s.done++;
    s.cost += a.cost ?? 0;
  }
  return map;
}

export type Phase = 'before' | 'during' | 'after';
export function tripPhase(snap: Snapshot, now = Date.now()): { phase: Phase; today: string; time: string; dayNumber: number } {
  const { date, time } = nowInZone(snap.trip.timezone, now);
  const { startDate, endDate } = snap.trip;
  const phase: Phase = date < startDate ? 'before' : date > endDate ? 'after' : 'during';
  const dayNumber = snap.days.findIndex((d) => d.date === date) + 1;
  return { phase, today: date, time, dayNumber };
}

export function legs(days: Day[]): Array<{ city: Day['city']; start: number; n: number }> {
  const out: Array<{ city: Day['city']; start: number; n: number }> = [];
  days.forEach((d, i) => {
    const last = out[out.length - 1];
    if (last && last.city === d.city) last.n++;
    else out.push({ city: d.city, start: i, n: 1 });
  });
  return out;
}

/** Índices de la actividad en curso y la siguiente según la hora local del destino. */
export function nowAndNext(acts: Activity[], time: string): { current: string | null; next: string | null } {
  const now = timeToMinutes(time);
  const timed = acts.filter((a) => a.time);
  let current: string | null = null;
  let next: string | null = null;
  for (const a of timed) {
    if (timeToMinutes(a.time) <= now) current = a.id;
    else {
      next = a.id;
      break;
    }
  }
  return { current, next };
}

export function nextPosition(list: Array<{ position: number }>): number {
  return list.reduce((m, x) => Math.max(m, x.position), 0) + 10;
}

/** Posición para insertar una actividad según su hora entre las ya ordenadas. */
export function positionForTime(acts: Activity[], time: string): number {
  if (!time) return nextPosition(acts);
  const t = timeToMinutes(time);
  let prev: Activity | undefined;
  let next: Activity | undefined;
  for (const a of acts) {
    if (a.time && timeToMinutes(a.time) <= t) prev = a;
    else if (a.time && !next) next = a;
  }
  if (!prev && !next) return nextPosition(acts);
  if (!next) return (prev?.position ?? 0) + 5;
  if (!prev) return next.position - 5;
  return (prev.position + next.position) / 2;
}

/** Posición entre dos vecinos tras reordenar (indexado fraccionario). */
export function positionBetween(before: Activity | undefined, after: Activity | undefined): number {
  if (!before && !after) return 10;
  if (!before) return after!.position - 10;
  if (!after) return before.position + 10;
  return (before.position + after.position) / 2;
}
