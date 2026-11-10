import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Droplets, Flame, Gauge, RefreshCw, Shirt, Sunrise, Sunset, SunMedium, ThermometerSun, ThumbsUp, Umbrella, Wind, CloudOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CITY_META } from '../../../shared/constants';
import { DOW_ES, addDays, dayOfMonth, dowIndex, formatTime12, longDate, timeToMinutes } from '../../../shared/time';
import type { HourPoint, WeatherDay } from '../../../shared/types';
import { HourlyChart, type Metric } from '../components/weather/HourlyChart';
import { WeatherIcon } from '../components/weather/WeatherIcon';
import { Seg } from '../components/ui/Seg';
import { cityClass } from '../lib/meta';
import { dayActivities, tripPhase } from '../lib/selectors';
import { centrarEnTira } from '../lib/tira';
import {
  advice,
  dayLength,
  hourAt,
  hourLabel,
  isDaytime,
  kindOf,
  labelOf,
  length,
  speed,
  speedUnit,
  temp,
  tempColor,
  tempUnit,
  type TipIcon,
  type Units,
} from '../lib/weather';
import { useStore } from '../store';

const TIP_ICON: Record<TipIcon, typeof Umbrella> = { umbrella: Umbrella, jacket: Shirt, sun: SunMedium, wind: Wind, heat: Flame, humid: Droplets, ok: ThumbsUp };

const uvLabel = (uv: number) => (uv < 3 ? 'Bajo' : uv < 6 ? 'Moderado' : uv < 8 ? 'Alto' : uv < 11 ? 'Muy alto' : 'Extremo');

function agoText(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
}

/** Posición del sol (0–1) entre el amanecer y el atardecer. */
function sunProgress(sunrise: string | null | undefined, sunset: string | null | undefined, time: string | null): number {
  if (!sunrise || !sunset) return 0.5;
  if (!time) return 0.5;
  const a = timeToMinutes(sunrise);
  const b = timeToMinutes(sunset);
  return Math.max(0, Math.min(1, (timeToMinutes(time) - a) / (b - a)));
}

function SunCard({ day, time, isToday }: { day: WeatherDay; time: string; isToday: boolean }) {
  const p = sunProgress(day.sunrise, day.sunset, isToday ? time : null);
  const R = 92;
  const cx = 120;
  const cy = 112;
  const ang = Math.PI * (1 - p);
  const sx = cx + R * Math.cos(ang);
  const sy = cy - R * Math.sin(ang);
  const night = isToday && (p <= 0 || p >= 1);
  return (
    <section className="card wx-card">
      <h2 className="card-title h-stretch">
        <Sunrise size={18} /> Sol
      </h2>
      <svg viewBox="0 0 240 132" className="sunarc" role="img" aria-label={`Amanecer ${day.sunrise ?? ''}, atardecer ${day.sunset ?? ''}`}>
        <defs>
          <linearGradient id="sa-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
        </defs>
        <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
        <motion.path
          d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`}
          fill="none"
          stroke="url(#sa-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: p }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <line x1={cx - R - 14} x2={cx + R + 14} y1={cy} y2={cy} stroke="var(--line)" strokeWidth="1.5" />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: night ? 0.45 : 1 }} transition={{ delay: 0.6 }}>
          <circle cx={sx} cy={sy} r="13" fill="#fbbf24" opacity="0.25" className="sun-pulse" />
          <circle cx={sx} cy={sy} r="8" fill="url(#wx-sun)" stroke="#f59e0b" strokeWidth="1.5" />
        </motion.g>
      </svg>
      <div className="sun-times">
        <div>
          <Sunrise size={16} />
          <strong className="tnum">{day.sunrise ? formatTime12(day.sunrise) : '—'}</strong>
          <small>Amanecer</small>
        </div>
        <div className="sun-mid">
          <strong>{dayLength(day.sunrise, day.sunset) || '—'}</strong>
          <small>de luz</small>
        </div>
        <div>
          <Sunset size={16} />
          <strong className="tnum">{day.sunset ? formatTime12(day.sunset) : '—'}</strong>
          <small>Atardecer</small>
        </div>
      </div>
    </section>
  );
}

function PlanForecast({ date, hours, daily, u, city }: { date: string; hours: HourPoint[] | undefined; daily: WeatherDay; u: Units; city: string }) {
  const snap = useStore((s) => s.snap)!;
  const acts = dayActivities(snap, date).filter((a) => a.time);
  return (
    <section className="card wx-card">
      <h2 className="card-title h-stretch">
        <CalendarClock size={18} /> Tus planes y el clima
      </h2>
      {acts.length === 0 ? (
        <p className="muted small">No hay actividades con hora este día en {city}. Añade horas en el itinerario y verás aquí el clima de cada plan.</p>
      ) : (
        <ul className="plan-wx">
          {acts.map((a) => {
            const h = hourAt(hours, a.time);
            const wet = (h?.rain ?? 0) >= 40;
            return (
              <li key={a.id} className={wet ? 'wet' : ''}>
                <span className="plan-time tnum">{formatTime12(a.time)}</span>
                <span className="plan-text">{a.text}</span>
                {h ? (
                  <span className="plan-wx-val">
                    <WeatherIcon code={h.code} night={!isDaytime(h.t, daily)} size={26} />
                    <strong className="tnum">{temp(h.temp, u)}°</strong>
                    <span className={`plan-rain${wet ? ' hot' : ''}`}>
                      <Droplets size={12} /> {h.rain}%
                    </span>
                  </span>
                ) : (
                  <span className="muted small">—</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function WeatherView() {
  const snap = useStore((s) => s.snap)!;
  const weather = useStore((s) => s.weather);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const date = useStore((s) => s.selectedDate);
  const selectDate = useStore((s) => s.selectDate);
  const loadWeather = useStore((s) => s.loadWeather);
  const toast = useStore((s) => s.toast);
  const online = useStore((s) => s.online);
  const [metric, setMetric] = useState<Metric>('temp');
  const [loading, setLoading] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const hourRow = useRef<HTMLDivElement>(null);

  const day = snap.days.find((d) => d.date === date) ?? snap.days[0];
  const { today, time } = tripPhase(snap);
  const isToday = day.date === today;
  const daily = weather?.cities[day.city]?.find((d) => d.date === day.date) ?? null;
  const hours = weather?.hourly?.[day.city]?.[day.date];
  const current = isToday ? weather?.current?.[day.city] : undefined;
  const adv = useMemo(() => (daily ? advice(daily, hours, units) : null), [daily, hours, units]);
  const kind = kindOf(current?.code ?? daily?.code ?? 3);

  // Rango de temperaturas de todo el viaje para las barras comparables.
  const range = useMemo(() => {
    const all = snap.days.map((d) => weather?.cities[d.city]?.find((x) => x.date === d.date)).filter(Boolean) as WeatherDay[];
    return all.length ? { lo: Math.min(...all.map((d) => d.min)), hi: Math.max(...all.map((d) => d.max)) } : null;
  }, [snap.days, weather]);

  useEffect(() => {
    centrarEnTira(strip.current, strip.current?.querySelector<HTMLElement>('[aria-current="true"]'));
  }, [date]);
  useEffect(() => {
    const row = hourRow.current;
    if (!row) return;
    const target = row.querySelector<HTMLElement>('[data-now="true"]') ?? row.children[8];
    if (target) row.scrollTo({ left: (target as HTMLElement).offsetLeft - 24, behavior: 'smooth' });
  }, [date, hours]);

  async function refresh() {
    setLoading(true);
    await loadWeather(true);
    setLoading(false);
    toast('Pronóstico actualizado', 'success');
  }

  const firstForecast = addDays(day.date, -16);
  const dayMax = daily ? temp(daily.max, units) : null;

  return (
    <div className="container">
      <header className="view-head">
        <div>
          <h1 className="display view-title">Clima</h1>
          <p className="muted">Cómo estará el tiempo cada día del viaje, hora por hora.</p>
        </div>
        <div className="view-head-side">
          <Seg
            value={units}
            onChange={(v) => setUnits(v)}
            label="Unidades"
            options={[
              { value: 'c', label: '°C' },
              { value: 'f', label: '°F' },
            ]}
          />
          <button className="btn ghost" onClick={refresh} disabled={loading || !online}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> {weather?.fetchedAt ? agoText(weather.fetchedAt) : 'Actualizar'}
          </button>
        </div>
      </header>

      {/* Selector de día */}
      <div className="wx-strip" ref={strip} role="tablist" aria-label="Días del viaje">
        {snap.days.map((d, i) => {
          const w = weather?.cities[d.city]?.find((x) => x.date === d.date);
          const active = d.date === day.date;
          return (
            <motion.button
              key={d.date}
              role="tab"
              aria-selected={active}
              aria-current={active}
              className={`wx-tile ${cityClass(d.city)}`}
              onClick={() => selectDate(d.date)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.96 }}
            >
              {active && <motion.span layoutId="wx-tile-pill" className="wx-tile-pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className="dow">{d.date === today ? 'Hoy' : DOW_ES[dowIndex(d.date)].slice(0, 3)}</span>
              <span className="num">{dayOfMonth(d.date)}</span>
              {w ? <WeatherIcon code={w.code} size={34} /> : <span className="wx-na">—</span>}
              <span className="hi tnum">{w ? `${temp(w.max, units)}°` : ''}</span>
              <span className="lo tnum">{w ? `${temp(w.min, units)}°` : ''}</span>
              <span className="city-dot" aria-hidden="true" />
            </motion.button>
          );
        })}
      </div>

      {!daily ? (
        <div className="card empty-state" style={{ marginTop: 18 }}>
          {online ? <ThermometerSun /> : <CloudOff />}
          <strong>Aún no hay pronóstico para este día</strong>
          <span>
            El servicio meteorológico publica hasta 16 días hacia adelante; el {longDate(day.date).toLowerCase()} estará disponible desde el {longDate(firstForecast).toLowerCase()}.
          </span>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={day.date} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {/* Resumen del día */}
            <section className="wx-hero" data-kind={kind} aria-label={`Clima del ${longDate(day.date)}`}>
              <div className="wx-hero-main">
                <div className="wx-hero-top">
                  <span className="chip glass">{CITY_META[day.city].name}</span>
                  <span className="wx-date">{longDate(day.date)}</span>
                  {isToday && <span className="chip now">Hoy</span>}
                </div>
                <div className="wx-now">
                  <WeatherIcon code={current?.code ?? daily.code} night={isToday && !isDaytime(time, daily)} size={110} className="wx-big" title={labelOf(daily.code)} />
                  <div>
                    <div className="wx-temp tnum">
                      {current ? temp(current.temp, units) : dayMax}
                      <sup>{tempUnit(units)}</sup>
                    </div>
                    <div className="wx-cond">{labelOf(current?.code ?? daily.code)}</div>
                    <div className="wx-hilo tnum">
                      {current ? 'Ahora · ' : ''}Máx {temp(daily.max, units)}° · Mín {temp(daily.min, units)}°
                    </div>
                  </div>
                </div>
                {adv && (
                  <>
                    <p className="wx-summary">{adv.summary}</p>
                    <ul className="wx-tips">
                      {adv.tips.map((t) => {
                        const Icon = TIP_ICON[t.icon];
                        return (
                          <li key={t.text}>
                            <Icon size={16} /> {t.text}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>

              <div className="wx-tiles">
                <div>
                  <Droplets size={18} />
                  <strong className="tnum">{daily.rain ?? 0}%</strong>
                  <small>Prob. de lluvia{daily.precip ? ` · ${length(daily.precip, units)}` : ''}</small>
                </div>
                <div>
                  <Gauge size={18} />
                  <strong className="tnum">{daily.humidity ?? '—'}{daily.humidity != null ? '%' : ''}</strong>
                  <small>Humedad media</small>
                </div>
                <div>
                  <Wind size={18} />
                  <strong className="tnum">
                    {daily.windMax != null ? speed(daily.windMax, units) : '—'} <em>{speedUnit(units)}</em>
                  </strong>
                  <small>Viento máximo</small>
                </div>
                <div>
                  <SunMedium size={18} />
                  <strong className="tnum">{daily.uv != null ? daily.uv.toFixed(0) : '—'}</strong>
                  <small>Índice UV{daily.uv != null ? ` · ${uvLabel(daily.uv)}` : ''}</small>
                </div>
                <div>
                  <ThermometerSun size={18} />
                  <strong className="tnum">
                    {daily.feelsMax != null ? `${temp(daily.feelsMax, units)}°` : '—'} <em>/ {daily.feelsMin != null ? `${temp(daily.feelsMin, units)}°` : '—'}</em>
                  </strong>
                  <small>Sensación máx / mín</small>
                </div>
                <div>
                  <Sunset size={18} />
                  <strong className="tnum">{daily.sunset ? formatTime12(daily.sunset) : '—'}</strong>
                  <small>Atardecer</small>
                </div>
              </div>
            </section>

            {/* Gráfica y horas */}
            <section className="card wx-card wx-chart-card">
              <div className="wx-chart-head">
                <h2 className="h-stretch card-title" style={{ margin: 0 }}>
                  Por hora
                </h2>
                <Seg
                  value={metric}
                  onChange={(v) => setMetric(v)}
                  label="Dato de la gráfica"
                  options={[
                    { value: 'temp', label: 'Temperatura' },
                    { value: 'rain', label: 'Lluvia' },
                    { value: 'wind', label: 'Viento' },
                  ]}
                />
              </div>
              {hours?.length ? (
                <>
                  <HourlyChart hours={hours} metric={metric} units={units} nowTime={isToday ? time : null} sunrise={daily.sunrise} sunset={daily.sunset} />
                  <div className="hour-row" ref={hourRow} aria-label="Pronóstico hora por hora">
                    {hours.map((h) => {
                      const now = isToday && h.t.slice(0, 2) === time.slice(0, 2);
                      return (
                        <div key={h.t} className={`hour${now ? ' now' : ''}`} data-now={now}>
                          <small>{now ? 'Ahora' : hourLabel(h.t)}</small>
                          <WeatherIcon code={h.code} night={!isDaytime(h.t, daily)} size={30} />
                          <strong className="tnum">{temp(h.temp, units)}°</strong>
                          <span className={`hr-rain${h.rain >= 40 ? ' hot' : ''}`}>
                            <Droplets size={11} />
                            {h.rain}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="muted small">Todavía no hay detalle por hora para este día.</p>
              )}
            </section>

            <div className="wx-two">
              <SunCard day={daily} time={time} isToday={isToday} />
              <PlanForecast date={day.date} hours={hours} daily={daily} u={units} city={CITY_META[day.city].name} />
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Panorama de todo el viaje */}
      {range && (
        <section className="card wx-card" style={{ marginTop: 18 }}>
          <h2 className="card-title h-stretch">
            <ThermometerSun size={18} /> Todo el viaje
          </h2>
          <ul className="wx-days">
            {snap.days.map((d) => {
              const w = weather?.cities[d.city]?.find((x) => x.date === d.date);
              const span = Math.max(1, range.hi - range.lo);
              const left = w ? ((w.min - range.lo) / span) * 100 : 0;
              const width = w ? Math.max(6, ((w.max - w.min) / span) * 100) : 0;
              return (
                <li key={d.date}>
                  <button className={d.date === day.date ? 'on' : ''} onClick={() => { selectDate(d.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={!w}>
                    <span className="wd-day">
                      <strong>{d.date === today ? 'Hoy' : `${DOW_ES[dowIndex(d.date)].slice(0, 3)} ${dayOfMonth(d.date)}`}</strong>
                      <small className={`city ${cityClass(d.city)}`}>{CITY_META[d.city].short}</small>
                    </span>
                    {w ? <WeatherIcon code={w.code} size={28} title={labelOf(w.code)} /> : <span />}
                    <span className="wd-rain tnum">{w && (w.rain ?? 0) >= 15 ? <><Droplets size={11} /> {w.rain}%</> : ''}</span>
                    <span className="wd-lo tnum">{w ? `${temp(w.min, units)}°` : '—'}</span>
                    <span className="wd-bar" aria-hidden="true">
                      {w && <i style={{ left: `${left}%`, width: `${width}%`, background: `linear-gradient(90deg, ${tempColor(w.min)}, ${tempColor(w.max)})` }} />}
                    </span>
                    <span className="wd-hi tnum">{w ? `${temp(w.max, units)}°` : '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="muted small wx-foot">
        Datos de Open-Meteo{weather?.stale ? ' (guardados; sin conexión al servicio)' : ''}. El pronóstico cubre hasta 16 días y se actualiza cada 30 minutos. Horas en el huso horario de {snap.trip.timezone.replace('_', ' ')}.
      </p>
    </div>
  );
}
