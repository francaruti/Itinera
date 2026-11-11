import { motion } from 'framer-motion';
import { Plane } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { cityMeta } from '../../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex } from '../../../../shared/time';
import type { Snapshot } from '../../../../shared/types';
import { cityClass } from '../../lib/meta';
import { dayStats, legs, tripPhase } from '../../lib/selectors';
import { centrarEnTira } from '../../lib/tira';
import { useStore } from '../../store';

const COL = 78;

export function RouteStrip({ snap }: { snap: Snapshot }) {
  const selected = useStore((s) => s.selectedDate);
  const selectDate = useStore((s) => s.selectDate);
  const stats = useMemo(() => dayStats(snap), [snap]);
  const { today } = tripPhase(snap);
  const segs = useMemo(() => legs(snap.days), [snap.days]);
  const scroller = useRef<HTMLDivElement>(null);
  const n = snap.days.length;

  useEffect(() => {
    centrarEnTira(scroller.current, scroller.current?.querySelector<HTMLElement>('[aria-current="true"]'));
  }, [selected]);

  return (
    <nav className="route" aria-label="Días del viaje" ref={scroller}>
      <div className="route-inner" style={{ gridTemplateColumns: `repeat(${n}, minmax(${COL}px, 1fr))`, minWidth: n * COL }}>
        {segs.map((l) => (
          <motion.div
            key={`${l.city}-${l.start}`}
            className={`leg ${cityClass(l.city)}`}
            style={{ gridColumn: `${l.start + 1} / span ${l.n}` }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + l.start * 0.03 }}
          >
            {l.n < 2 ? cityMeta(l.city).short : cityMeta(l.city).name}
          </motion.div>
        ))}
        <div className="bar" aria-hidden="true">
          {snap.days.map((d, i) => (
            <motion.i
              key={d.date}
              className={cityClass(d.city)}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: 'left' }}
              transition={{ delay: 0.15 + i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
        {snap.days.map((d, i) => {
          const st = stats.get(d.date);
          const pct = st && st.total ? st.done / st.total : 0;
          const active = d.date === selected;
          const isToday = d.date === today;
          return (
            <motion.button
              key={d.date}
              className={`day-btn ${cityClass(d.city)}${d.travel ? ' travel' : ''}${isToday ? ' today' : ''}`}
              aria-current={active}
              aria-label={`${DOW_ES[dowIndex(d.date)]} ${dayOfMonth(d.date)}${isToday ? ', hoy' : ''}`}
              onClick={() => selectDate(d.date)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.035 }}
              whileTap={{ scale: 0.95 }}
            >
              {active && <motion.span layoutId="day-pill" className="day-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="dow">
                {DOW_ES[dowIndex(d.date)].slice(0, 3)}
                {d.travel && <Plane size={11} className="dow-plane" />}
              </span>
              <span className="num">{dayOfMonth(d.date)}</span>
              <span className="cnt">{isToday ? 'Hoy' : st && st.total ? `${st.done}/${st.total}` : ''}</span>
              <span className="dp" aria-hidden="true">
                <motion.i initial={false} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.5 }} />
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
