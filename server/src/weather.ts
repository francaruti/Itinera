import { cityMeta } from '../../shared/constants';
import type { City, CurrentWeather, HourPoint, WeatherDay, WeatherPayload } from '../../shared/types';
import type { Store } from './store';

const TTL = 30 * 60 * 1000;

interface OpenMeteo {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: (number | null)[];
    weather_code: number[];
    wind_speed_10m: number[];
    relative_humidity_2m: number[];
    uv_index: (number | null)[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
    uv_index_max: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

const r1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? 0 : Math.round(n * 10) / 10);
const hhmm = (iso: string | null | undefined) => (iso ? String(iso).slice(11, 16) : null);

interface CityData {
  daily: WeatherDay[];
  hourly: Record<string, HourPoint[]>;
  current?: CurrentWeather;
}

async function fetchCity(city: City, timeZone: string, wanted: Set<string>, signal: AbortSignal): Promise<CityData> {
  const { lat, lng } = cityMeta(city);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,uv_index',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    timezone: timeZone,
    forecast_days: '16',
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const json = (await res.json()) as OpenMeteo;

  const hourly: Record<string, HourPoint[]> = {};
  const h = json.hourly;
  if (h) {
    h.time.forEach((iso, i) => {
      const date = iso.slice(0, 10);
      if (!wanted.has(date)) return;
      (hourly[date] ??= []).push({
        t: iso.slice(11, 16),
        temp: r1(h.temperature_2m[i]),
        feels: r1(h.apparent_temperature[i]),
        rain: Math.round(h.precipitation_probability[i] ?? 0),
        code: h.weather_code[i],
        wind: Math.round(h.wind_speed_10m[i] ?? 0),
        hum: Math.round(h.relative_humidity_2m[i] ?? 0),
        uv: r1(h.uv_index[i]),
      });
    });
  }

  const d = json.daily;
  const daily: WeatherDay[] = d
    ? d.time.map((date, i) => {
        const hours = hourly[date];
        return {
          date,
          code: d.weather_code[i],
          max: Math.round(d.temperature_2m_max[i]),
          min: Math.round(d.temperature_2m_min[i]),
          rain: d.precipitation_probability_max[i] ?? null,
          sunset: hhmm(d.sunset[i]),
          sunrise: hhmm(d.sunrise[i]),
          feelsMax: Math.round(d.apparent_temperature_max[i]),
          feelsMin: Math.round(d.apparent_temperature_min[i]),
          uv: d.uv_index_max[i] == null ? null : r1(d.uv_index_max[i]),
          windMax: d.wind_speed_10m_max[i] == null ? null : Math.round(d.wind_speed_10m_max[i]!),
          precip: d.precipitation_sum[i] == null ? null : r1(d.precipitation_sum[i]),
          humidity: hours?.length ? Math.round(hours.reduce((n, p) => n + p.hum, 0) / hours.length) : null,
        };
      })
    : [];

  const c = json.current;
  const current: CurrentWeather | undefined = c
    ? { temp: r1(c.temperature_2m), feels: r1(c.apparent_temperature), code: c.weather_code, wind: Math.round(c.wind_speed_10m), hum: Math.round(c.relative_humidity_2m), time: c.time }
    : undefined;

  return { daily, hourly, current };
}

/** Pronóstico de las ciudades del viaje (diario + por hora), con caché y respaldo persistente para uso sin conexión. */
export function createWeather(store: Store) {
  let cache: { key: string; payload: WeatherPayload } | null = null;
  let inflight: { key: string; promise: Promise<WeatherPayload> } | null = null;

  async function load(wanted: Partial<Record<City, string[]>>, timeZone: string): Promise<WeatherPayload> {
    try {
      const signal = AbortSignal.timeout(8000);
      const cities = Object.keys(wanted) as City[];
      const entries = await Promise.all(cities.map(async (c) => [c, await fetchCity(c, timeZone, new Set(wanted[c]), signal)] as const));
      const payload: WeatherPayload = {
        fetchedAt: Date.now(),
        cities: Object.fromEntries(entries.map(([c, v]) => [c, v.daily])),
        hourly: Object.fromEntries(entries.map(([c, v]) => [c, v.hourly])),
        current: Object.fromEntries(entries.filter(([, v]) => v.current).map(([c, v]) => [c, v.current!])),
      };
      await store.setMeta('weather', JSON.stringify(payload)).catch(() => undefined);
      return payload;
    } catch {
      const saved = await store.getMeta('weather').catch(() => null);
      if (saved) return { ...(JSON.parse(saved) as WeatherPayload), stale: true };
      return { fetchedAt: 0, stale: true, cities: {} };
    }
  }

  /** `wanted`: fechas del viaje por ciudad (solo de esas se devuelve el detalle por hora). */
  return async function getWeather(wanted: Partial<Record<City, string[]>>, timeZone: string, force = false): Promise<WeatherPayload> {
    const key = JSON.stringify(wanted);
    if (!force && cache && cache.key === key && Date.now() - cache.payload.fetchedAt < TTL && !cache.payload.stale) return cache.payload;
    if (!inflight || inflight.key !== key) {
      const promise = load(wanted, timeZone).finally(() => {
        if (inflight?.key === key) inflight = null;
      });
      inflight = { key, promise };
    }
    const payload = await inflight.promise;
    cache = { key, payload };
    return payload;
  };
}
