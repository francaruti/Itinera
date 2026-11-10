import type { HourPoint, WeatherDay } from '../../../shared/types';

export type Units = 'c' | 'f';

export const toF = (c: number) => (c * 9) / 5 + 32;
export const temp = (c: number, u: Units) => Math.round(u === 'f' ? toF(c) : c);
export const tempUnit = (u: Units) => (u === 'f' ? '°F' : '°C');
export const speed = (kmh: number, u: Units) => Math.round(u === 'f' ? kmh * 0.621371 : kmh);
export const speedUnit = (u: Units) => (u === 'f' ? 'mph' : 'km/h');
export const length = (mm: number, u: Units) => (u === 'f' ? `${(mm / 25.4).toFixed(2)} in` : `${mm} mm`);

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

/** Código WMO (Open-Meteo) → tipo de icono y texto en español. */
export function kindOf(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}

const LABEL: Record<WeatherKind, string> = {
  clear: 'Despejado',
  partly: 'Parcialmente nublado',
  cloudy: 'Nublado',
  fog: 'Niebla',
  drizzle: 'Llovizna',
  rain: 'Lluvia',
  storm: 'Tormenta',
  snow: 'Nieve',
};
export const labelOf = (code: number) => (code === 1 ? 'Mayormente despejado' : code === 80 || code === 81 || code === 82 ? 'Chubascos' : LABEL[kindOf(code)]);

/** Punto horario más cercano a "HH:mm". */
export function hourAt(hours: HourPoint[] | undefined, time: string): HourPoint | null {
  if (!hours?.length || !time) return null;
  const h = Number(time.slice(0, 2));
  return hours.find((p) => Number(p.t.slice(0, 2)) === h) ?? null;
}

export const isDaytime = (t: string, day?: Pick<WeatherDay, 'sunrise' | 'sunset'> | null) => {
  const sr = day?.sunrise ?? '06:30';
  const ss = day?.sunset ?? '19:00';
  return t >= sr && t < ss;
};

/** Duración de luz solar "11 h 35 min". */
export function dayLength(sunrise?: string | null, sunset?: string | null): string {
  if (!sunrise || !sunset) return '';
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const mins = m(sunset) - m(sunrise);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

export type TipIcon = 'umbrella' | 'jacket' | 'sun' | 'wind' | 'heat' | 'humid' | 'ok';
export interface Advice {
  summary: string;
  tips: Array<{ icon: TipIcon; text: string }>;
}

/** Resumen y recomendaciones en lenguaje claro para un día. */
export function advice(day: WeatherDay, hours: HourPoint[] | undefined, u: Units): Advice {
  const rain = Math.max(day.rain ?? 0, ...(hours?.map((h) => h.rain) ?? [0]));
  const wind = Math.max(day.windMax ?? 0, ...(hours?.map((h) => h.wind) ?? [0]));
  const uv = day.uv ?? 0;
  const tips: Advice['tips'] = [];

  let rainLine: string;
  if (rain >= 60) {
    rainLine = 'Es probable que llueva.';
    tips.push({ icon: 'umbrella', text: 'Lluvia probable: lleva paraguas o impermeable.' });
  } else if (rain >= 30) {
    rainLine = 'Podría haber chubascos.';
    tips.push({ icon: 'umbrella', text: 'Posibles chubascos: un paraguas pequeño no sobra.' });
  } else if (rain >= 15) {
    rainLine = 'Poca probabilidad de lluvia.';
  } else {
    rainLine = 'Casi sin probabilidad de lluvia.';
  }

  if (day.max <= 12) tips.push({ icon: 'jacket', text: 'Hace frío: abrigo, capas y algo para las manos.' });
  else if (day.min <= 12) tips.push({ icon: 'jacket', text: 'Mañana y noche frescas: lleva una chaqueta.' });
  else if (day.min <= 17 && day.max <= 22) tips.push({ icon: 'jacket', text: 'Clima templado: una chaqueta ligera te cae bien.' });

  if (day.max >= 30) tips.push({ icon: 'heat', text: 'Calor: lleva agua, gorra y haz pausas a la sombra.' });
  if (uv >= 6) tips.push({ icon: 'sun', text: 'Índice UV alto: usa protector solar y gafas.' });
  else if (uv >= 3) tips.push({ icon: 'sun', text: 'UV moderado: protector solar si pasas horas afuera.' });
  if (wind >= 35) tips.push({ icon: 'wind', text: 'Viento fuerte: ojo con paraguas y terrazas.' });
  else if (wind >= 25) tips.push({ icon: 'wind', text: 'Día ventoso: una capa cortaviento ayuda.' });
  if ((day.humidity ?? 0) >= 80 && day.max >= 26) tips.push({ icon: 'humid', text: 'Húmedo y bochornoso: ropa liviana y transpirable.' });

  if (tips.length === 0) tips.push({ icon: 'ok', text: 'Día cómodo: no necesitas nada especial.' });

  const summary = `${labelOf(day.code)}, con máxima de ${temp(day.max, u)}° y mínima de ${temp(day.min, u)}°. ${rainLine}`;
  return { summary, tips: tips.slice(0, 4) };
}

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
export function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [4, [59, 130, 246]], // azul
  [13, [34, 211, 238]], // celeste
  [22, [253, 224, 71]], // amarillo
  [29, [251, 146, 60]], // naranja
  [36, [239, 68, 68]], // rojo
];

/** Color de la barra de temperatura (azul frío → celeste → amarillo → naranja), interpolado en RGB. */
export function tempColor(c: number): string {
  const [first] = TEMP_STOPS;
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (c <= first[0]) return `rgb(${first[1].join(' ')})`;
  if (c >= last[0]) return `rgb(${last[1].join(' ')})`;
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const [t0, a] = TEMP_STOPS[i];
    const [t1, b] = TEMP_STOPS[i + 1];
    if (c >= t0 && c <= t1) {
      const f = (c - t0) / (t1 - t0);
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(' ')})`;
    }
  }
  return `rgb(${last[1].join(' ')})`;
}

/** Hora corta "3 pm". */
export function hourLabel(t: string): string {
  const h = Number(t.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'pm' : 'am'}`;
}
