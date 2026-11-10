import { DOW_ES, dayDiff, dayOfMonth, formatTime12, nowInZone, zonedToUtcMs } from '../../../shared/time';
import type { Reservation, Snapshot } from '../../../shared/types';

export type UpcomingKind = 'flight' | 'hotel' | 'ticket' | 'activity';
export type Urgency = 'now' | 'soon' | 'later';

export interface Upcoming {
  /** Clave estable para recordar que ya se avisó. */
  key: string;
  kind: UpcomingKind;
  id: string;
  title: string;
  /** "Hoy · 7:00 pm", "Mañana · 5:20 am", "Lun 12 · 7:00 pm" */
  when: string;
  ms: number;
  urgency: Urgency;
  /** Para vuelos: aún no hay pase de abordar guardado. */
  missingDoc?: boolean;
}

const HOUR = 3_600_000;
/** Cuánto tiempo antes empieza a verse un plan en el acceso directo. */
export const LOOKAHEAD_H = 48;

function reservationStart(r: Reservation): { date: string; time: string; exact: boolean; label: 'sale' | 'llega' | '' } | null {
  const raw = r.startsAt || r.endsAt;
  if (!raw) return null;
  const date = raw.slice(0, 10);
  const exact = raw.length > 10;
  // Sin hora (p. ej. hoteles): se cuenta desde la tarde del día, pero no se muestra una hora inventada.
  const time = exact ? raw.slice(11, 16) : r.kind === 'hotel' ? '15:00' : '09:00';
  return { date, time, exact, label: r.kind === 'flight' && !r.startsAt ? 'llega' : '' };
}

function whenLabel(date: string, time: string | null, today: string): string {
  const d = dayDiff(today, date);
  const day = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${DOW_ES[new Date(`${date}T12:00:00Z`).getUTCDay()].slice(0, 3)} ${dayOfMonth(date)}`;
  return time ? `${day} · ${formatTime12(time)}` : day;
}

/** Reservas y actividades con reserva que ocurren pronto (o empezaron hace menos de 45 min), de la más cercana a la más lejana. */
export function upcomingItems(snap: Snapshot, nowMs = Date.now()): Upcoming[] {
  const tz = snap.trip.timezone;
  const today = nowInZone(tz, nowMs).date;
  const out: Upcoming[] = [];
  const consider = (it: Omit<Upcoming, 'urgency' | 'when'> & { date: string; time: string; exact?: boolean }) => {
    const away = it.ms - nowMs;
    if (away < -0.75 * HOUR || away > LOOKAHEAD_H * HOUR) return;
    const urgency: Urgency = away <= 3 * HOUR ? 'now' : away <= 24 * HOUR ? 'soon' : 'later';
    out.push({ key: it.key, kind: it.kind, id: it.id, title: it.title, ms: it.ms, urgency, when: whenLabel(it.date, it.exact === false ? null : it.time, today), missingDoc: it.missingDoc });
  };

  const withDoc = new Set((snap.attachments ?? []).map((a) => a.reservationId));
  for (const r of snap.reservations) {
    if (r.kind === 'other' && r.status === 'todo') continue;
    const s = reservationStart(r);
    if (!s) continue;
    const kind = r.kind === 'other' ? 'ticket' : r.kind;
    consider({
      key: `res:${r.id}`,
      kind,
      id: r.id,
      title: s.label === 'llega' ? `Llegada: ${r.title}` : r.kind === 'hotel' ? `Check-in: ${r.title}` : r.title,
      date: s.date,
      time: s.time,
      exact: s.exact,
      ms: zonedToUtcMs(s.date, s.time, tz),
      missingDoc: r.kind === 'flight' && !withDoc.has(r.id),
    });
  }
  for (const a of snap.activities) {
    if (a.booking !== 'booked' || !a.time || a.done || a.category === 'transport' || a.category === 'lodging') continue;
    consider({ key: `act:${a.id}`, kind: 'activity', id: a.id, title: a.text, date: a.dayDate, time: a.time, ms: zonedToUtcMs(a.dayDate, a.time, tz) });
  }
  return out.sort((x, y) => x.ms - y.ms);
}
