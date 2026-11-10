import type { WeatherKind } from '../../lib/weather';
import { kindOf } from '../../lib/weather';

const CLOUD = 'M9 25a6 6 0 0 1-.6-11.97A8 8 0 0 1 23.7 11.6 6.6 6.6 0 0 1 24.5 25z';

function Sun({ cx = 16, cy = 16, r = 5.6, rays = true }: { cx?: number; cy?: number; r?: number; rays?: boolean }) {
  return (
    <g>
      {rays && (
        <g className="wx-rays" style={{ transformOrigin: `${cx}px ${cy}px` }} stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={cx + Math.cos(a) * (r + 2.6)} y1={cy + Math.sin(a) * (r + 2.6)} x2={cx + Math.cos(a) * (r + 5)} y2={cy + Math.sin(a) * (r + 5)} />;
          })}
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill="url(#wx-sun)" className="wx-sun-core" />
    </g>
  );
}

function Moon({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return <path className="wx-moon" transform={`translate(${x} ${y}) scale(${scale})`} d="M22.5 19.5A9 9 0 1 1 12.5 7.4a7.2 7.2 0 0 0 10 12.1z" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="0.6" />;
}

function Cloud({ dark = false, tx = 0, ty = 0, scale = 1, drift = true }: { dark?: boolean; tx?: number; ty?: number; scale?: number; drift?: boolean }) {
  return (
    <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
      <path d={CLOUD} className={drift ? 'wx-drift' : undefined} fill={dark ? 'var(--wx-cloud-dark)' : 'var(--wx-cloud)'} />
    </g>
  );
}

interface Props {
  /** Código WMO o tipo ya resuelto. */
  code?: number;
  kind?: WeatherKind;
  night?: boolean;
  size?: number;
  className?: string;
  title?: string;
}

/** Iconos de clima animados en SVG (se detienen con "reducir movimiento"). */
export function WeatherIcon({ code = 0, kind, night, size = 32, className = '', title }: Props) {
  const k = kind ?? kindOf(code);
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={`wx ${className}`} role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id="wx-sun" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fbbf24" />
        </radialGradient>
      </defs>

      {k === 'clear' && (night ? <Moon x={1} y={2} scale={1.05} /> : <Sun />)}

      {k === 'partly' && (
        <>
          {night ? <Moon x={-3} y={-3} scale={0.9} /> : <Sun cx={12} cy={12} r={4.6} />}
          <Cloud tx={3} ty={4} scale={0.9} />
        </>
      )}

      {k === 'cloudy' && (
        <>
          <Cloud dark tx={-2} ty={-3} scale={0.85} />
          <Cloud tx={1} ty={3} scale={0.95} />
        </>
      )}

      {k === 'fog' && (
        <g className="wx-fog" stroke="var(--wx-cloud-dark)" strokeWidth="2.2" strokeLinecap="round">
          <Cloud tx={0} ty={-5} scale={0.95} drift={false} />
          <line x1="6" y1="22" x2="24" y2="22" />
          <line x1="9" y1="26" x2="27" y2="26" />
        </g>
      )}

      {(k === 'drizzle' || k === 'rain' || k === 'storm') && (
        <>
          <Cloud dark={k !== 'drizzle'} ty={-4} scale={0.95} />
          {k === 'storm' ? (
            <path className="wx-bolt" d="M17 19l-4 6h3l-1.5 5 5.5-7.5h-3.2z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
          ) : (
            <g stroke="#3b82f6" strokeWidth={k === 'drizzle' ? 1.4 : 2} strokeLinecap="round">
              <line className="wx-drop d1" x1="11" y1="23" x2="9.6" y2="27" />
              <line className="wx-drop d2" x1="17" y1="23" x2="15.6" y2="27" />
              <line className="wx-drop d3" x1="23" y1="23" x2="21.6" y2="27" />
            </g>
          )}
        </>
      )}

      {k === 'snow' && (
        <>
          <Cloud ty={-4} scale={0.95} />
          <g fill="#93c5fd">
            <circle className="wx-flake f1" cx="11" cy="24" r="1.4" />
            <circle className="wx-flake f2" cx="17" cy="25" r="1.4" />
            <circle className="wx-flake f3" cx="23" cy="24" r="1.4" />
          </g>
        </>
      )}
    </svg>
  );
}
