import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Calendar, MapPin, PartyPopper, Plane, Sparkles } from 'lucide-react';
import { PLANE_PATH } from './Logo';
import { HeroPhotos } from './photos/HeroPhotos';
import { useMemo, type MouseEvent } from 'react';
import { cityMeta } from '../../../shared/constants';
import {
  DOW_ES,
  MONTH_ES,
  dayOfMonth,
  dowIndex,
  formatTime12,
  monthIndex,
  timeToMinutes,
  zonedToUtcMs,
} from '../../../shared/time';
import type { Snapshot } from '../../../shared/types';
import { useNow } from '../hooks/useNow';
import { dayActivities, dayStats, tripPhase, nowAndNext } from '../lib/selectors';
import { useStore } from '../store';
import { AnimatedNumber } from './ui/AnimatedNumber';

const lower = (s: string) => s.toLowerCase();

function rangeText(start: string, end: string) {
  if (!start) return '';
  const a = `${lower(DOW_ES[dowIndex(start)])} ${dayOfMonth(start)}`;
  const b = `${lower(DOW_ES[dowIndex(end)])} ${dayOfMonth(end)}`;
  const sameMonth = monthIndex(start) === monthIndex(end);
  const year = start.slice(0, 4);
  return sameMonth
    ? `Del ${a} al ${b} de ${MONTH_ES[monthIndex(end)]} de ${year}`
    : `Del ${a} de ${MONTH_ES[monthIndex(start)]} al ${b} de ${MONTH_ES[monthIndex(end)]} de ${year}`;
}

const SKYLINE = [
  [0, 30], [16, 52], [30, 40], [44, 66], [58, 48], [72, 84], [84, 58, 'spire'], [100, 74], [114, 46], [128, 62], [142, 38], [156, 54], [170, 30], [184, 44],
] as const;

function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 220 100" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      {SKYLINE.map(([x, h, kind], i) => (
        <g key={i}>
          <rect x={x} y={100 - h} width="13" height={h} rx="1.5" />
          {kind === 'spire' && <path d={`M${x + 3} ${100 - h} L${x + 6.5} ${100 - h - 30} L${x + 10} ${100 - h}Z`} />}
        </g>
      ))}
    </svg>
  );
}

function Palm() {
  return (
    <svg className="palm" viewBox="0 0 120 160" aria-hidden="true">
      <path d="M62 160c-2-40-6-72-14-110 2 0 6 0 8 2 6 34 10 70 12 108z" />
      <path d="M52 52C34 38 18 40 4 52c14-4 30-2 46 6zM54 50C46 28 28 20 10 24c18 4 30 14 40 30zM58 48c0-22 10-38 30-46-12 12-18 26-22 48zM60 52c14-14 30-18 50-12-16 2-30 8-42 20zM56 56c18 0 34 8 44 24-14-12-28-16-46-14z" />
    </svg>
  );
}

function RouteArc({ labels }: { labels: [string, string, string] }) {
  return (
    <div className="route-arc" aria-hidden="true">
      <svg className="arc-path" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M2 34 Q 26 -14 50 34 T 98 34" vectorEffect="non-scaling-stroke" />
      </svg>
      <svg className="arc-plane" viewBox="0 0 24 24" width="22" height="22">
        <path d={PLANE_PATH} fill="currentColor" />
      </svg>
      <span style={{ left: '2%' }}>{labels[0]}</span>
      <span style={{ left: '50%' }}>{labels[1]}</span>
      <span style={{ left: '98%' }}>{labels[2]}</span>
    </div>
  );
}

function Digit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0');
  return (
    <div className="cd-tile">
      <div className="cd-num">
        {text.split('').map((ch, i) => (
          <motion.span key={`${i}-${ch}`} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28 }}>
            {ch}
          </motion.span>
        ))}
      </div>
      <small>{label}</small>
    </div>
  );
}

function Countdown({ snap }: { snap: Snapshot }) {
  const now = useNow(1000);
  const first = snap.days[0];
  const firstTimed = first ? dayActivities(snap, first.date).find((a) => a.time) : undefined;
  const target = first ? zonedToUtcMs(first.date, firstTimed?.time ?? '00:00', snap.trip.timezone) : now;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="hero-card">
      <div className="hero-card-title">
        <Sparkles size={16} /> Cuenta regresiva
      </div>
      <div className="cd-grid" role="timer" aria-label={`Faltan ${d} días ${h} horas`}>
        <Digit value={d} label="días" />
        <Digit value={h} label="horas" />
        <Digit value={m} label="min" />
        <Digit value={s} label="seg" />
      </div>
      <p className="hero-card-foot">
        <Plane size={15} /> Empieza en {first ? cityMeta(first.city).name : 'tu destino'}
        {firstTimed ? ` · primer plan a las ${formatTime12(firstTimed.time)}` : ''}
      </p>
    </div>
  );
}

function Today({ snap, today, time, dayNumber }: { snap: Snapshot; today: string; time: string; dayNumber: number }) {
  const setTab = useStore((s) => s.setTab);
  const selectDate = useStore((s) => s.selectDate);
  const day = snap.days.find((d) => d.date === today)!;
  const acts = dayActivities(snap, today);
  const { next } = nowAndNext(acts, time);
  const nextAct = acts.find((a) => a.id === next);
  const mins = nextAct ? timeToMinutes(nextAct.time) - timeToMinutes(time) : 0;
  const when = mins >= 60 ? `en ${Math.floor(mins / 60)} h ${mins % 60} min` : `en ${mins} min`;
  return (
    <div className="hero-card">
      <div className="hero-card-title">
        <MapPin size={16} /> Hoy · día {dayNumber} de {snap.days.length}
      </div>
      <p className="hero-card-big">{cityMeta(day.city).name}</p>
      <p className="hero-card-line">{day.title}</p>
      {nextAct ? (
        <p className="hero-card-foot">
          <strong>{formatTime12(nextAct.time)}</strong> · {nextAct.text} <em>({when})</em>
        </p>
      ) : (
        <p className="hero-card-foot">Sin más planes con hora por hoy.</p>
      )}
      <button
        className="btn yellow sm"
        onClick={() => {
          selectDate(today);
          setTab('itinerario');
        }}
      >
        <Calendar size={15} /> Ver el día
      </button>
    </div>
  );
}

function Done({ snap }: { snap: Snapshot }) {
  const stats = [...dayStats(snap).values()];
  const done = stats.reduce((n, s) => n + s.done, 0);
  const total = stats.reduce((n, s) => n + s.total, 0);
  return (
    <div className="hero-card">
      <div className="hero-card-title">
        <PartyPopper size={16} /> Viaje completado
      </div>
      <p className="hero-card-big">
        <AnimatedNumber value={done} /> / {total}
      </p>
      <p className="hero-card-line">actividades marcadas como hechas.</p>
    </div>
  );
}

export function Hero({ snap }: { snap: Snapshot }) {
  const now = useNow(30_000);
  const { phase, today, time, dayNumber } = tripPhase(snap, now);
  const [l1, l2] = useMemo(() => {
    const parts = snap.trip.name.split('+').map((s) => s.trim());
    return [parts[0], parts[1] ? `+ ${parts[1]}` : ''];
  }, [snap.trip.name]);
  const cityNames = useMemo(() => {
    const first = snap.days[0]?.city ?? 'ny';
    const mid = snap.days.find((d) => d.city !== first)?.city ?? first;
    return [cityMeta(first).short, cityMeta(mid).short, cityMeta(snap.days[snap.days.length - 1]?.city ?? first).short] as [string, string, string];
  }, [snap.days]);

  const mx = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 20 });
  const skyX = useTransform(sx, (v) => v * -14);
  const palmX = useTransform(sx, (v) => v * 18);
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
  };

  return (
    <motion.section
      className="hero"
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <HeroPhotos />
      <motion.div className="hero-layer sky" style={{ x: skyX }}>
        <Skyline />
      </motion.div>
      <motion.div className="hero-layer pal" style={{ x: palmX }}>
        <Palm />
      </motion.div>
      <div className="sun" aria-hidden="true" />

      <div className="hero-main">
        <h1 className="display hero-title">
          {l1}
          {l2 && (
            <>
              <br />
              <span className="hero-title-2">{l2}</span>
            </>
          )}
        </h1>
        <p className="hero-dates">{rangeText(snap.trip.startDate, snap.trip.endDate)}</p>
        <RouteArc labels={cityNames} />
      </div>

      <div className="hero-side">
        {phase === 'before' && <Countdown snap={snap} />}
        {phase === 'during' && <Today snap={snap} today={today} time={time} dayNumber={dayNumber} />}
        {phase === 'after' && <Done snap={snap} />}
      </div>
    </motion.section>
  );
}
