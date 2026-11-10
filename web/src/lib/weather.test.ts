import { describe, expect, it } from 'vitest';
import type { HourPoint, WeatherDay } from '../../../shared/types';
import { advice, dayLength, hourAt, hourLabel, kindOf, labelOf, smoothPath, speed, temp, tempColor } from './weather';

const day = (over: Partial<WeatherDay> = {}): WeatherDay => ({ date: '2026-10-05', code: 3, max: 18, min: 9, rain: 5, sunset: '18:31', sunrise: '06:56', uv: 5, windMax: 28, humidity: 60, ...over });
const hours: HourPoint[] = Array.from({ length: 24 }, (_, h) => ({ t: `${String(h).padStart(2, '0')}:00`, temp: 10 + h / 2, feels: 9, rain: 0, code: 3, wind: 10, hum: 60, uv: 0 }));

describe('unidades', () => {
  it('convierte °C a °F y km/h a mph', () => {
    expect(temp(0, 'f')).toBe(32);
    expect(temp(100, 'f')).toBe(212);
    expect(temp(19.4, 'c')).toBe(19);
    expect(speed(100, 'f')).toBe(62);
  });
});

describe('códigos del clima', () => {
  it('clasifica y traduce', () => {
    expect(kindOf(0)).toBe('clear');
    expect(kindOf(61)).toBe('rain');
    expect(kindOf(95)).toBe('storm');
    expect(labelOf(2)).toBe('Parcialmente nublado');
    expect(labelOf(81)).toBe('Chubascos');
  });
});

describe('consejos', () => {
  it('avisa de lluvia probable y frío', () => {
    const a = advice(day({ rain: 80, max: 11, min: 6, uv: 1 }), hours, 'c');
    expect(a.tips.map((t) => t.icon)).toEqual(expect.arrayContaining(['umbrella', 'jacket']));
    expect(a.summary).toContain('Es probable que llueva');
  });
  it('avisa de calor y UV alto', () => {
    const a = advice(day({ max: 32, min: 24, uv: 8, rain: 0, windMax: 10 }), undefined, 'c');
    expect(a.tips.map((t) => t.icon)).toEqual(expect.arrayContaining(['heat', 'sun']));
  });
  it('un día cómodo no pide nada especial', () => {
    const a = advice(day({ max: 25, min: 20, uv: 1, rain: 0, windMax: 8, humidity: 50 }), undefined, 'c');
    expect(a.tips).toEqual([{ icon: 'ok', text: 'Día cómodo: no necesitas nada especial.' }]);
  });
  it('respeta las unidades en el resumen', () => {
    expect(advice(day({ max: 20, min: 10 }), undefined, 'f').summary).toContain('68°');
  });
  it('limita a 4 recomendaciones', () => {
    const a = advice(day({ rain: 90, max: 31, min: 25, uv: 9, windMax: 40, humidity: 90 }), undefined, 'c');
    expect(a.tips.length).toBeLessThanOrEqual(4);
  });
});

describe('utilidades', () => {
  it('busca la hora más cercana', () => {
    expect(hourAt(hours, '17:45')?.t).toBe('17:00');
    expect(hourAt(hours, '')).toBeNull();
    expect(hourAt(undefined, '10:00')).toBeNull();
  });
  it('calcula la duración de luz', () => {
    expect(dayLength('06:56', '18:31')).toBe('11 h 35 min');
    expect(dayLength(null, '18:00')).toBe('');
  });
  it('formatea horas', () => {
    expect(hourLabel('00:00')).toBe('12 am');
    expect(hourLabel('15:00')).toBe('3 pm');
  });
  it('genera una curva suave que pasa por los puntos extremos', () => {
    const d = smoothPath([[0, 10], [10, 0], [20, 10]]);
    expect(d.startsWith('M0.0,10.0')).toBe(true);
    expect(d.endsWith('20.0,10.0')).toBe(true);
    expect(smoothPath([])).toBe('');
  });
  it('colorea de azul (frío) a naranja/rojo (calor)', () => {
    expect(tempColor(0)).toBe('rgb(59 130 246)');
    expect(tempColor(22)).toBe('rgb(253 224 71)');
    expect(tempColor(40)).toBe('rgb(239 68 68)');
    expect(tempColor(17)).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
  });
});
