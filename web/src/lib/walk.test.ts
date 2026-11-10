import { describe, expect, it } from 'vitest';
import { splitChains } from './walk';

const s = (id: string, lat: number, lng: number) => ({ id, lat, lng });

describe('cadenas a pie', () => {
  it('une paradas cercanas y corta cuando el salto es largo', () => {
    const chains = splitChains([s('a', 40.75, -73.98), s('b', 40.752, -73.977), s('c', 40.755, -73.98), s('orl', 28.42, -81.58), s('d', 28.421, -81.581), s('e', 28.423, -81.583)]);
    expect(chains.map((c) => c.map((x) => x.id))).toEqual([['a', 'b', 'c'], ['orl', 'd', 'e']]);
  });
  it('una parada suelta no forma cadena', () => {
    expect(splitChains([s('a', 40.75, -73.98)])).toEqual([]);
    expect(splitChains([s('a', 40.75, -73.98), s('far', 28.4, -81.5)])).toEqual([]);
  });
  it('divide las cadenas de más de 20 puntos', () => {
    const many = Array.from({ length: 25 }, (_, i) => s(`p${i}`, 40.75 + i * 0.0001, -73.98));
    const chains = splitChains(many);
    expect(chains.every((c) => c.length <= 20)).toBe(true);
    expect(chains.flat().length).toBeGreaterThanOrEqual(25);
  });
});
