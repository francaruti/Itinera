import { Droplets, Sunset } from 'lucide-react';
import { formatTime12 } from '../../../../shared/time';
import type { City } from '../../../../shared/types';
import { weatherInfo } from '../../lib/meta';
import { useStore } from '../../store';

export function useDayWeather(city: City, date: string) {
  const weather = useStore((s) => s.weather);
  return weather?.cities[city]?.find((w) => w.date === date) ?? null;
}

export function WeatherChip({ city, date }: { city: City; date: string }) {
  const w = useDayWeather(city, date);
  const setTab = useStore((s) => s.setTab);
  if (!w) return null;
  const { icon: Icon, label } = weatherInfo(w.code);
  return (
    <button className="weather-chip" title={`${label}. Toca para ver el clima detallado`} onClick={() => setTab('clima')} aria-label={`Ver clima detallado: ${label}, máxima ${w.max} grados`}>
      <Icon size={22} />
      <div>
        <strong className="tnum">
          {w.max}° <span className="muted">/ {w.min}°</span>
        </strong>
        <small>
          {label}
          {w.rain != null && w.rain > 0 && (
            <>
              {' '}
              · <Droplets size={11} /> {w.rain}%
            </>
          )}
          {w.sunset && (
            <>
              {' '}
              · <Sunset size={11} /> {formatTime12(w.sunset)}
            </>
          )}
        </small>
      </div>
    </button>
  );
}
