import { describe, expect, it } from 'vitest';
import { zonedToUtcMs } from '../../../shared/time';
import type { Snapshot } from '../../../shared/types';
import { upcomingItems } from './upcoming';

const tz = 'America/New_York';
const snap = (over: Partial<Snapshot>): Snapshot => ({
  rev: 1,
  trip: { name: 'T', timezone: tz, budgetUsd: 0, travelers: [], startDate: '2026-10-05', endDate: '2026-10-15' },
  days: [],
  activities: [],
  checklist: [],
  reservations: [],
  expenses: [],
  attachments: [],
  ...over,
});
const res = (o: Record<string, unknown>) => ({ id: 'r1', kind: 'flight', title: 'NY → Orlando', provider: '', confirmation: '', startsAt: '', endsAt: '', city: 'ny', address: '', amount: null, currency: 'USD', status: 'booked', paid: false, url: '', notes: '', position: 1, ...o }) as Snapshot['reservations'][number];

describe('próximos planes', () => {
  const now = zonedToUtcMs('2026-10-05', '20:00', tz);

  it('marca como urgente lo que pasa en menos de 3 h y avisa si falta el pase de abordar', () => {
    const list = upcomingItems(snap({ reservations: [res({ startsAt: '2026-10-05T22:00' })] }), now);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ urgency: 'now', kind: 'flight', missingDoc: true, when: 'Hoy · 10:00 pm' });
  });
  it('no avisa de pase faltante si ya hay un archivo guardado', () => {
    const s = snap({ reservations: [res({ startsAt: '2026-10-06T12:30' })], attachments: [{ id: 'a', reservationId: 'r1', name: 'p.jpg', label: '', mime: 'image/jpeg', size: 1, createdAt: 1 }] });
    const [it] = upcomingItems(s, now);
    expect(it).toMatchObject({ urgency: 'soon', missingDoc: false, when: 'Mañana · 12:30 pm' });
  });
  it('ignora lo lejano (más de 48 h) y lo que ya pasó hace rato', () => {
    const s = snap({ reservations: [res({ id: 'a', startsAt: '2026-10-09T10:00' }), res({ id: 'b', startsAt: '2026-10-05T10:00' })] });
    expect(upcomingItems(s, now)).toEqual([]);
  });
  it('un vuelo sin salida usa la llegada, y un hotel sin hora cuenta desde las 3 p. m.', () => {
    const s = snap({ reservations: [res({ id: 'v', endsAt: '2026-10-06T05:20' }), res({ id: 'h', kind: 'hotel', title: 'Hilton', startsAt: '2026-10-06' })] });
    const list = upcomingItems(s, now);
    expect(list.map((i) => i.title)).toEqual(['Llegada: NY → Orlando', 'Check-in: Hilton']);
  });
  it('incluye actividades reservadas con hora', () => {
    const s = snap({ activities: [{ id: 'x', dayDate: '2026-10-06', position: 1, time: '19:00', text: 'Cena en Au Cheval', done: false, category: 'food', place: '', lat: null, lng: null, cost: null, booking: 'booked', url: '', notes: '' }] });
    expect(upcomingItems(s, now)[0]).toMatchObject({ kind: 'activity', when: 'Mañana · 7:00 pm', urgency: 'soon' });
  });
});
