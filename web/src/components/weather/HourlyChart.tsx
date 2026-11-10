import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HourPoint } from '../../../../shared/types';
import { hourLabel, smoothPath, speed, speedUnit, temp, tempUnit, type Units } from '../../lib/weather';

export type Metric = 'temp' | 'rain' | 'wind';

interface Props {
  hours: HourPoint[];
  metric: Metric;
  units: Units;
  /** Hora local actual (HH:mm) para marcar "Ahora" si el día es hoy. */
  nowTime?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
}

const H = 210;
const PAD = { t: 36, b: 30, x: 22 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/** Gráfica por hora estilo Google: línea suave con degradé, valores cada 3 h y lectura al tocar o pasar el cursor. */
export function HourlyChart({ hours, metric, units, nowTime, sunrise, sunset }: Props) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = hours.length;

  const values = useMemo(
    () => hours.map((h) => (metric === 'temp' ? temp(h.temp, units) : metric === 'rain' ? h.rain : speed(h.wind, units))),
    [hours, metric, units],
  );

  if (n < 2) return <div ref={ref} className="muted small">Sin pronóstico por hora para este día.</div>;

  const innerW = w - PAD.x * 2;
  const step = innerW / (n - 1);
  const x = (i: number) => PAD.x + i * step;
  const lo = metric === 'rain' ? 0 : metric === 'wind' ? 0 : Math.min(...values) - 2;
  const hi = metric === 'rain' ? 100 : metric === 'wind' ? Math.max(20, Math.max(...values) * 1.25) : Math.max(...values) + 2;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${x(n - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const unit = metric === 'temp' ? tempUnit(units) : metric === 'rain' ? '%' : speedUnit(units);
  const nowIdx = nowTime ? hours.findIndex((h) => h.t.slice(0, 2) === nowTime.slice(0, 2)) : -1;
  const idx = hover ?? null;
  const tip = idx != null ? hours[idx] : null;

  const toIdx = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(n - 1, Math.round((clientX - rect.left - PAD.x) / step)));
  const dayRange = (() => {
    const sr = sunrise ? hours.findIndex((h) => h.t >= sunrise) : -1;
    const ss = sunset ? hours.findIndex((h) => h.t >= sunset) : -1;
    return sr >= 0 && ss > sr ? { a: x(sr), b: x(ss) } : null;
  })();

  return (
    <div ref={ref} className="hchart" onPointerLeave={() => setHover(null)}>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`Gráfica por hora de ${metric === 'temp' ? 'temperatura' : metric === 'rain' ? 'probabilidad de lluvia' : 'viento'}`}
        onPointerMove={(e) => setHover(toIdx(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerDown={(e) => setHover(toIdx(e.clientX, e.currentTarget.getBoundingClientRect()))}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          <linearGradient id="hc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.38" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hc-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--accent-bright)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>

        {dayRange && <rect x={dayRange.a} y={PAD.t - 18} width={dayRange.b - dayRange.a} height={H - PAD.t - PAD.b + 18} rx="10" className="hc-daylight" />}

        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.x} x2={w - PAD.x} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} className="hc-grid" />
        ))}

        {metric === 'rain' ? (
          values.map((v, i) => {
            const bh = Math.max(2, H - PAD.b - y(v));
            return (
              <motion.rect
                key={`${metric}-${i}`}
                x={x(i) - step * 0.32}
                width={step * 0.64}
                rx="3"
                fill="url(#hc-line)"
                opacity={hover === i ? 1 : 0.8}
                initial={{ y: H - PAD.b, height: 0 }}
                animate={{ y: H - PAD.b - bh, height: bh }}
                transition={{ delay: i * 0.012, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })
        ) : (
          <>
            <motion.path key={`a-${metric}-${w}`} d={area} fill="url(#hc-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
            <motion.path
              key={`l-${metric}-${w}`}
              d={line}
              fill="none"
              stroke="url(#hc-line)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </>
        )}

        {/* valores cada 3 horas */}
        {hours.map((h, i) =>
          i % 3 === 0 ? (
            <g key={h.t}>
              <text x={x(i)} y={metric === 'rain' ? y(values[i]) - 6 : y(values[i]) - 10} textAnchor="middle" className="hc-val">
                {values[i]}
                {metric === 'temp' ? '°' : metric === 'rain' ? '%' : ''}
              </text>
              <text x={x(i)} y={H - 8} textAnchor="middle" className="hc-x">
                {hourLabel(h.t)}
              </text>
            </g>
          ) : null,
        )}

        {nowIdx >= 0 && (
          <g>
            <line x1={x(nowIdx)} x2={x(nowIdx)} y1={PAD.t - 10} y2={H - PAD.b} className="hc-now" />
            <text x={x(nowIdx)} y={PAD.t - 14} textAnchor="middle" className="hc-nowlabel">
              Ahora
            </text>
          </g>
        )}

        {idx != null && (
          <g pointerEvents="none">
            <line x1={x(idx)} x2={x(idx)} y1={PAD.t - 10} y2={H - PAD.b} className="hc-cursor" />
            <circle cx={x(idx)} cy={y(values[idx])} r="5.5" className="hc-dot" />
          </g>
        )}
      </svg>

      {tip && idx != null && (
        <div className="hc-tip" style={{ left: Math.min(Math.max(x(idx), 70), w - 70) }} role="status">
          <strong>
            {values[idx]}
            {unit}
          </strong>
          <span>{hourLabel(tip.t)}</span>
          <small>
            Lluvia {tip.rain}% · Humedad {tip.hum}%
          </small>
        </div>
      )}
    </div>
  );
}
