import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, formatTime12, longDate, normalizeTime, rangoCorto, timeToMinutes, zonedToUtcMs } from './time';

describe('time utils', () => {
  it('normaliza horas', () => {
    expect(normalizeTime('5:20')).toBe('05:20');
    expect(normalizeTime('13')).toBe('13:00');
    expect(normalizeTime('25:00')).toBe('');
    expect(normalizeTime('abc')).toBe('');
  });
  it('formatea en 12 horas', () => {
    expect(formatTime12('00:05')).toBe('12:05 am');
    expect(formatTime12('15:27')).toBe('3:27 pm');
    expect(formatTime12('')).toBe('');
  });
  it('ordena vacíos al final', () => {
    expect(timeToMinutes('')).toBeGreaterThan(timeToMinutes('23:59'));
  });
  it('convierte una hora local de America/New_York a UTC con horario de verano', () => {
    expect(new Date(zonedToUtcMs('2026-10-05', '05:20', 'America/New_York')).toISOString()).toBe('2026-10-05T09:20:00.000Z');
    // Después del cambio de horario (1 nov 2026) el offset es -5
    expect(new Date(zonedToUtcMs('2026-11-02', '12:00', 'America/New_York')).toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });
  it('suma días y diferencias', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayDiff('2026-10-05', '2026-10-15')).toBe(10);
    expect(longDate('2026-10-05')).toBe('Lunes 5 de octubre');
  });
  it('resume un rango de fechas para la cabecera', () => {
    expect(rangoCorto('2026-10-05', '2026-10-15')).toBe('5 – 15 oct 2026');
    expect(rangoCorto('2026-09-30', '2026-10-04')).toBe('30 sep – 4 oct 2026');
    expect(rangoCorto('2026-12-30', '2027-01-02')).toBe('30 dic 2026 – 2 ene 2027');
    expect(rangoCorto('2026-10-05', '2026-10-05')).toBe('5 oct 2026');
    expect(rangoCorto('', '')).toBe('');
  });
});
