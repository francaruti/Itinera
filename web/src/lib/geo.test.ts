import { describe, expect, it } from 'vitest';
import { estimate, flightEstimate, formatDistance, formatDuration } from './geo';
import { defaultMode, type RouteSet } from './routing';

describe('formato', () => {
  it('duraciones legibles', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(14 * 60 + 10)).toBe('14 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3600 + 5 * 60)).toBe('1 h 05 min');
    expect(formatDuration(30 * 3600)).toBe('1 d 6 h');
  });
  it('distancias legibles', () => {
    expect(formatDistance(42)).toBe('40 m');
    expect(formatDistance(1175)).toBe('1,2 km');
    expect(formatDistance(412_000)).toBe('412 km');
  });
});

describe('estimaciones sin conexión', () => {
  it('a pie es más lento que en bici y que en carro', () => {
    const f = estimate('foot', 2).duration;
    const b = estimate('bike', 2).duration;
    const c = estimate('car', 2).duration;
    expect(f).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(Math.round(f / 60)).toBeGreaterThan(25); // ~2 km a pie con rodeo ≈ 34 min
  });
  it('el avión suma ~45 min de rodaje y avisa si la distancia es muy corta', () => {
    expect(flightEstimate(1755).duration / 3600).toBeCloseTo(1755 / 800 + 0.75, 1);
    expect(flightEstimate(30).tooShort).toBe(true);
    expect(flightEstimate(1755).tooShort).toBe(false);
  });
});

describe('modo por defecto', () => {
  const r = (duration: number) => ({ mode: 'foot' as const, distance: 1, duration });
  const set = (over: Partial<RouteSet>): RouteSet => ({ foot: null, bike: null, car: null, plane: { ...r(1), mode: 'plane' }, km: 1, offline: false, ...over });
  it('a pie si es cerca, carro si es lejos, avión si es otro continente', () => {
    expect(defaultMode(set({ foot: r(600), car: r(120), km: 1 }))).toBe('foot');
    expect(defaultMode(set({ foot: r(3 * 3600), bike: r(3600), car: r(900), km: 12 }))).toBe('car');
    expect(defaultMode(set({ km: 4200 }))).toBe('plane');
    expect(defaultMode(set({ foot: r(40 * 3600), car: r(20 * 3600), km: 1755 }))).toBe('plane');
  });
});
