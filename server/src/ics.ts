import { zonedToUtcMs, addDays, normalizeTime } from '../../shared/time';
import type { Snapshot } from '../../shared/types';

const fmtUtc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fmtDate = (d: string) => d.replace(/-/g, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Pliega líneas a 75 octetos según RFC 5545. */
function fold(line: string): string {
  const bytes = Buffer.from(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(snap: Snapshot): string {
  const tz = snap.trip.timezone;
  const stamp = fmtUtc(Date.now());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Viajes//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(snap.trip.name)}`, `X-WR-TIMEZONE:${tz}`];

  for (const a of snap.activities) {
    const time = normalizeTime(a.time);
    lines.push('BEGIN:VEVENT', `UID:${a.id}@viajes`, `DTSTAMP:${stamp}`);
    if (time) {
      const start = zonedToUtcMs(a.dayDate, time, tz);
      lines.push(`DTSTART:${fmtUtc(start)}`, `DTEND:${fmtUtc(start + 60 * 60000)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(a.dayDate)}`, `DTEND;VALUE=DATE:${fmtDate(addDays(a.dayDate, 1))}`);
    }
    lines.push(`SUMMARY:${esc(a.text)}`);
    if (a.place) lines.push(`LOCATION:${esc(a.place)}`);
    const desc = [a.notes, a.url].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (a.lat != null && a.lng != null) lines.push(`GEO:${a.lat};${a.lng}`);
    lines.push('END:VEVENT');
  }

  for (const r of snap.reservations) {
    if (!r.startsAt) continue;
    const [date, time = ''] = r.startsAt.split('T');
    lines.push('BEGIN:VEVENT', `UID:${r.id}@viajes`, `DTSTAMP:${stamp}`);
    if (time) {
      const start = zonedToUtcMs(date, time, tz);
      const end = r.endsAt.includes('T') ? zonedToUtcMs(...(r.endsAt.split('T') as [string, string]), tz) : start + 60 * 60000;
      lines.push(`DTSTART:${fmtUtc(start)}`, `DTEND:${fmtUtc(Math.max(end, start + 60000))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(date)}`, `DTEND;VALUE=DATE:${fmtDate(addDays(r.endsAt ? r.endsAt.slice(0, 10) : date, r.endsAt ? 0 : 1))}`);
    }
    lines.push(`SUMMARY:${esc(`Reserva: ${r.title}`)}`);
    if (r.address) lines.push(`LOCATION:${esc(r.address)}`);
    const desc = [[r.provider, r.flightNo].filter(Boolean).join(' '), r.confirmation && `Confirmación: ${r.confirmation}`, r.notes].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
