import { CalendarCheck, Check, Clock3, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { formatTime12, timeToMinutes } from '../../../../shared/time';
import type { Activity } from '../../../../shared/types';
import { useNow } from '../../hooks/useNow';
import { estimate, formatDuration, kmBetween, useQuickLocation } from '../../lib/geo';
import { tap } from '../../lib/haptics';
import { op } from '../../lib/ops';
import { nowAndNext, tripPhase } from '../../lib/selectors';
import { useStore } from '../../store';

/** Durante el viaje: el siguiente plan del día en grande, con cuánto falta y cuándo salir. */
export function NextUp({ acts, date }: { acts: Activity[]; date: string }) {
  const snap = useStore((s) => s.snap)!;
  const dispatch = useStore((s) => s.dispatch);
  const setTab = useStore((s) => s.setTab);
  const openDetail = useStore((s) => s.openDetail);
  const setMapGoto = useStore((s) => s.setMapGoto);
  const now = useNow(30_000);
  const { today, time, phase } = tripPhase(snap, now);
  const { current, next } = useMemo(() => nowAndNext(acts, time), [acts, time]);
  const pendingNext = acts.find((a) => a.id === next && !a.done) ?? acts.find((a) => a.time && timeToMinutes(a.time) > timeToMinutes(time) && !a.done);
  const target = pendingNext ?? acts.find((a) => a.id === current && !a.done) ?? null;
  const me = useQuickLocation(target?.id ?? '');

  if (phase !== 'during' || today !== date || !target) return null;

  const until = target.time ? timeToMinutes(target.time) - timeToMinutes(time) : null;
  const isNow = until != null && until <= 0;
  let travel: { min: number; mode: 'foot' | 'car'; km: number } | null = null;
  if (me && target.lat != null && target.lng != null) {
    const km = kmBetween(me, { lat: target.lat, lng: target.lng });
    const mode = km > 4 ? 'car' : 'foot';
    travel = { min: Math.max(1, Math.round(estimate(mode, km).duration / 60)), mode, km };
  }
  const leaveIn = until != null && travel ? until - travel.min - 5 : null;

  const label = isNow ? 'Ahora' : until != null ? `En ${formatDuration(until * 60)}` : 'Siguiente';
  const pct = until != null && !isNow ? Math.max(0, Math.min(1, 1 - until / 90)) : 1;

  return (
    <section className={`nu${isNow ? ' now' : ''}`} aria-label="Siguiente plan">
      <div className="nu-top">
        <span className="nu-chip">
          <Clock3 size={13} /> {label}
        </span>
        {target.time && <span className="nu-time">{formatTime12(target.time)}</span>}
      </div>
      <h3 className="clamp-2">{target.text}</h3>
      {target.place && <p className="clamp-1">{target.place}</p>}

      <div className="nu-bar" aria-hidden="true">
        <i style={{ width: `${pct * 100}%` }} />
      </div>

      <p className="nu-travel">
        {travel
          ? `${travel.mode === 'foot' ? 'A pie' : 'En carro'} ≈ ${formatDuration(travel.min * 60)} desde donde estás${leaveIn != null ? (leaveIn <= 0 ? ' · ya es hora de salir' : ` · sal en ${formatDuration(leaveIn * 60)}`) : ''}`
          : 'Activa tu ubicación en el mapa para ver cuánto tardas en llegar.'}
      </p>

      <div className="nu-actions">
        {target.lat != null && target.lng != null && (
          <button
            type="button"
            className="nu-btn primary"
            onClick={() => {
              tap();
              setMapGoto({ name: target.place || target.text, lat: target.lat!, lng: target.lng!, activityId: target.id });
              setTab('mapa');
            }}
          >
            <Navigation size={16} /> Cómo llegar
          </button>
        )}
        <button type="button" className="nu-btn" onClick={() => openDetail(target.id)}>
          <CalendarCheck size={16} /> Detalle
        </button>
        <button
          type="button"
          className="nu-btn"
          onClick={() => {
            tap();
            dispatch(op.activity.patch(target.id, { done: true }));
          }}
          aria-label="Marcar como hecha"
        >
          <Check size={16} /> Hecha
        </button>
      </div>
    </section>
  );
}
