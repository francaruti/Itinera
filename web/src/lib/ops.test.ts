import { describe, expect, it } from 'vitest';
import type { Activity, Snapshot } from '../../../shared/types';
import { applyOp, applyOps, coalesce, op } from './ops';
import { parseQuickAdd } from './format';
import { guessCategory } from './guess';
import { positionBetween, positionForTime } from './selectors';

const act = (over: Partial<Activity> = {}): Activity => ({
  id: 'a1', dayDate: '2026-10-05', position: 10, time: '', text: 'x', done: false, category: 'other',
  place: '', lat: null, lng: null, cost: null, booking: 'none', url: '', notes: '', ...over,
});

const base = (): Snapshot => ({
  rev: 1,
  trip: { name: 'T', timezone: 'America/New_York', budgetUsd: 0, travelers: [], startDate: '2026-10-05', endDate: '2026-10-06' },
  days: [
    { date: '2026-10-05', city: 'ny', travel: false, title: '', notes: '' },
    { date: '2026-10-06', city: 'orlando', travel: false, title: '', notes: '' },
  ],
  activities: [act()],
  checklist: [],
  reservations: [],
  expenses: [],
  attachments: [],
});

describe('reducer cliente', () => {
  it('put / patch / delete de actividades', () => {
    let s = applyOp(base(), op.activity.put(act({ id: 'a2', text: 'nueva' })));
    expect(s.activities).toHaveLength(2);
    s = applyOp(s, op.activity.patch('a2', { done: true }));
    expect(s.activities.find((a) => a.id === 'a2')?.done).toBe(true);
    s = applyOp(s, op.activity.del('a1'));
    expect(s.activities.map((a) => a.id)).toEqual(['a2']);
  });

  it('borrar un día elimina sus actividades y recalcula fechas', () => {
    const s = applyOp(base(), op.day.del('2026-10-05'));
    expect(s.activities).toHaveLength(0);
    expect(s.trip.startDate).toBe('2026-10-06');
  });

  it('añade un día manteniendo el orden', () => {
    const s = applyOp(base(), op.day.put({ date: '2026-10-04', city: 'ny', travel: false, title: '', notes: '' }));
    expect(s.days.map((d) => d.date)[0]).toBe('2026-10-04');
    expect(s.trip.startDate).toBe('2026-10-04');
  });

  it('un patch sobre una entidad inexistente no hace nada', () => {
    const s = base();
    expect(applyOp(s, op.activity.patch('nope', { done: true })).activities).toEqual(s.activities);
  });

  it('applyOps es inmutable', () => {
    const s = base();
    applyOps(s, [op.activity.patch('a1', { text: 'cambiado' })]);
    expect(s.activities[0].text).toBe('x');
  });
});

describe('coalesce', () => {
  it('fusiona parches consecutivos de la misma entidad', () => {
    let q = coalesce([], op.activity.patch('a1', { text: 'a' }), 0);
    q = coalesce(q, op.activity.patch('a1', { text: 'ab', done: true }), 0);
    expect(q).toHaveLength(1);
    expect(q[0].data).toEqual({ text: 'ab', done: true });
  });
  it('no toca operaciones ya enviadas (protegidas)', () => {
    let q = coalesce([], op.activity.patch('a1', { text: 'a' }), 0);
    q = coalesce(q, op.activity.patch('a1', { text: 'b' }), 1);
    expect(q).toHaveLength(2);
  });
  it('put seguido de delete se anulan', () => {
    let q = coalesce([], op.activity.put(act({ id: 'z' })), 0);
    q = coalesce(q, op.activity.del('z'), 0);
    expect(q).toHaveLength(0);
  });
  it('put + patch se fusiona en un solo put', () => {
    let q = coalesce([], op.activity.put(act({ id: 'z' })), 0);
    q = coalesce(q, op.activity.patch('z', { done: true }), 0);
    expect(q).toHaveLength(1);
    expect(q[0].action).toBe('put');
    expect(q[0].data?.done).toBe(true);
  });
});

describe('parseQuickAdd', () => {
  it('detecta la hora al inicio', () => {
    expect(parseQuickAdd("14:30 Almuerzo en Katz's")).toEqual({ time: '14:30', text: "Almuerzo en Katz's" });
    expect(parseQuickAdd('2pm Cena')).toEqual({ time: '14:00', text: 'Cena' });
    expect(parseQuickAdd('9:15 am Desayuno')).toEqual({ time: '09:15', text: 'Desayuno' });
    expect(parseQuickAdd('12 am Medianoche')).toEqual({ time: '00:00', text: 'Medianoche' });
  });
  it('no confunde números sin formato de hora', () => {
    expect(parseQuickAdd('5 amigos en el parque').time).toBe('');
    expect(parseQuickAdd('Visitar Times Square').time).toBe('');
    expect(parseQuickAdd('25:00 algo').time).toBe('');
  });
});

describe('orden fraccionario', () => {
  const list = [act({ id: '1', time: '09:00', position: 10 }), act({ id: '2', time: '12:00', position: 20 }), act({ id: '3', time: '', position: 30 })];
  it('inserta según la hora', () => {
    expect(positionForTime(list, '10:00')).toBe(15);
    expect(positionForTime(list, '08:00')).toBe(5);
    expect(positionForTime(list, '13:00')).toBe(25);
    expect(positionForTime(list, '')).toBe(40);
  });
  it('calcula posición entre vecinos', () => {
    expect(positionBetween(list[0], list[1])).toBe(15);
    expect(positionBetween(undefined, list[0])).toBe(0);
    expect(positionBetween(list[2], undefined)).toBe(40);
  });
});

describe('guessCategory', () => {
  it('clasifica por palabras clave', () => {
    expect(guessCategory('Almuerzo en Koreatown')).toBe('food');
    expect(guessCategory('Vuelo a Orlando')).toBe('transport');
    expect(guessCategory('Show de Broadway')).toBe('show');
    expect(guessCategory('Algo raro')).toBe('other');
  });
});
