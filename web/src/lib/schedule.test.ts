import { describe, expect, it } from 'vitest';
import type { CatalogPlace } from '../../../shared/catalog';
import type { Activity, Snapshot } from '../../../shared/types';
import { alternativesFor, catalogFor, distanceKm, indexCatalog, openStatus, retime, textFor, travelLabel, walkMinutes } from './schedule';

const place = (over: Partial<CatalogPlace> & Pick<CatalogPlace, 'id' | 'name'>): CatalogPlace => ({
  city: 'ny', category: 'food', slot: 'lunch', address: 'x', lat: 40.758, lng: -73.9855, minutes: 45, why: 'porque sí', tips: [], rating: 4.5, ...over,
});

const act = (over: Partial<Activity> = {}): Activity => ({
  id: 'a1', dayDate: '2026-10-12', position: 10, time: '13:00', text: 'Almuerzo', done: false, category: 'food',
  place: '', lat: null, lng: null, cost: null, booking: 'none', url: '', notes: '', ...over,
});

describe('openStatus', () => {
  const p = { hours: { mon: ['11:00', '22:00'] as [string, string], tue: null, wed: ['18:00', '26:00'] as [string, string] } };
  it('abierto y cerrado dentro del día', () => {
    expect(openStatus(p, '2026-10-12', '13:00').state).toBe('open'); // lunes
    expect(openStatus(p, '2026-10-12', '10:00')).toEqual({ state: 'closed', label: 'Abre 11:00 am' });
    expect(openStatus(p, '2026-10-12', '23:00').label).toBe('Ya cerrado a esa hora');
  });
  it('día de cierre y horario desconocido', () => {
    expect(openStatus(p, '2026-10-13', '13:00')).toEqual({ state: 'closed', label: 'Cerrado ese día' });
    expect(openStatus(p, '2026-10-15', '13:00').state).toBe('unknown'); // jueves sin dato
    expect(openStatus({ hours: null }, '2026-10-12', '13:00').state).toBe('unknown');
  });
  it('cierres después de medianoche', () => {
    expect(openStatus(p, '2026-10-14', '23:30').state).toBe('open'); // miércoles hasta las 2 am
    expect(openStatus(p, '2026-10-15', '01:30').state).toBe('open'); // madrugada del jueves
    expect(openStatus(p, '2026-10-15', '03:00').state).toBe('unknown');
  });
});

describe('distancias', () => {
  it('Times Square ↔ Grand Central ≈ 0,8 km', () => {
    const km = distanceKm({ lat: 40.758, lng: -73.9855 }, { lat: 40.7527, lng: -73.9772 });
    expect(km).toBeGreaterThan(0.7);
    expect(km).toBeLessThan(1.1);
    expect(walkMinutes(km)).toBeLessThan(18);
  });
  it('lejos pasa a metro', () => {
    expect(travelLabel(5)).toContain('metro');
    expect(travelLabel(0.4)).toBe('7 min a pie');
  });
});

describe('catalogFor', () => {
  const idx = indexCatalog([place({ id: 'joes', name: "Joe's Pizza", aliases: ['Joes Pizza Broadway'] }), place({ id: 'joe', name: 'Joe' })]);
  it('por lugar exacto, alias o texto', () => {
    expect(catalogFor(act({ place: "Joe's Pizza" }), idx)?.id).toBe('joes');
    expect(catalogFor(act({ place: 'joes pizza broadway' }), idx)?.id).toBe('joes');
    expect(catalogFor(act({ text: "Cena en Joe's Pizza (Broadway)" }), idx)?.id).toBe('joes');
    expect(catalogFor(act({ text: 'Descanso' }), idx)).toBeNull();
  });
});

describe('retime', () => {
  const idx = indexCatalog([place({ id: 'long', name: 'Restaurante largo', minutes: 120 })]);
  const day = [
    act({ id: 'a', time: '12:00', position: 10, place: 'Restaurante largo' }),
    act({ id: 'b', time: '13:00', position: 20, text: 'Museo', category: 'sight' }),
    act({ id: 'c', time: '16:00', position: 30, text: 'Paseo', category: 'sight' }),
    act({ id: 'd', time: '', position: 40, text: 'Libre' }),
  ];
  it('empuja solo lo que se traslapa y respeta lo demás', () => {
    const shifts = retime(day, 'a', idx);
    expect(shifts[0]).toEqual({ id: 'b', from: '13:00', to: '14:15' });
    // 14:15 + 75 min de museo + 15 de colchón = 15:45 → "c" a las 16:00 ya no necesita moverse
    expect(shifts.find((s) => s.id === 'c')).toBeUndefined();
    expect(shifts.find((s) => s.id === 'd')).toBeUndefined();
  });
  it('no adelanta horarios', () => {
    const early = [act({ id: 'a', time: '10:00', position: 10 }), act({ id: 'b', time: '18:00', position: 20 })];
    expect(retime(early, 'a', idx)).toEqual([]);
  });
});

describe('alternativas', () => {
  const catalog = [
    place({ id: 'cur', name: 'Actual', lat: 40.7527, lng: -73.9772 }),
    place({ id: 'near', name: 'Cerca', lat: 40.7535, lng: -73.978, rating: 4.4 }),
    place({ id: 'far', name: 'Lejos', lat: 40.8, lng: -73.9, rating: 4.9 }),
    place({ id: 'closed', name: 'Cerrado', hours: { mon: null }, rating: 5 }),
    place({ id: 'brk', name: 'Desayuno', slot: 'breakfast', lat: 40.7527, lng: -73.9772 }),
    place({ id: 'dess', name: 'Postre', slot: 'dessert', lat: 40.7527, lng: -73.9772 }),
    place({ id: 'mia', name: 'Miami', city: 'miami' as never }),
    place({ id: 'view', name: 'Mirador', category: 'sight', slot: 'view' }),
  ];
  const idx = indexCatalog(catalog);
  const snap = {
    rev: 1, trip: { name: 't', timezone: 'America/New_York', budgetUsd: 0, travelers: [], startDate: '2026-10-12', endDate: '2026-10-12' },
    days: [{ date: '2026-10-12', city: 'ny', travel: false, title: '', notes: '' }],
    activities: [act({ id: 'x', position: 5, text: 'Paseo', category: 'sight', lat: 40.7527, lng: -73.9772, place: 'Grand Central' }), act({ id: 'a1', position: 10, place: 'Actual' })],
    checklist: [], reservations: [], expenses: [],
  } as unknown as Snapshot;

  it('prioriza cercanía y calificación, filtra cerrados, otras ciudades y tipos distintos', () => {
    const alts = alternativesFor(snap.activities[1], snap, catalog, idx);
    const ids = alts.map((a) => a.place.id);
    expect(ids).toContain('near');
    expect(ids).not.toContain('closed');
    expect(ids).not.toContain('mia');
    expect(ids).not.toContain('brk'); // desayuno no sustituye un almuerzo
    expect(ids).not.toContain('dess');
    expect(ids).not.toContain('view');
    expect(ids).not.toContain('cur'); // la actual
    expect(ids[0]).toBe('near');
  });
  it('no repite lugares ya usados en el viaje', () => {
    const withUsed = { ...snap, activities: [...snap.activities, act({ id: 'u', position: 20, place: 'Cerca' })] } as Snapshot;
    expect(alternativesFor(withUsed.activities[1], withUsed, catalog, idx).map((a) => a.place.id)).not.toContain('near');
  });
  it('texto según el momento', () => {
    expect(textFor(catalog[0])).toBe('Almuerzo en Actual');
    expect(textFor(catalog[7])).toBe('Mirador');
  });
});
