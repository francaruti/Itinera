import { motion } from 'framer-motion';
import { ArrowRight, BedDouble, ChevronDown, Plane, Ticket } from 'lucide-react';
import { CITY_META } from '../../../../shared/constants';
import { formatTime12 } from '../../../../shared/time';
import type { City, Reservation, Snapshot } from '../../../../shared/types';
import { tap } from '../../lib/haptics';
import { useStore } from '../../store';
import { Ring } from '../ui/Ring';

function reservationsFor(snap: Snapshot, date: string): Reservation[] {
  return snap.reservations.filter((r) => {
    const start = r.startsAt.slice(0, 10);
    const end = r.endsAt.slice(0, 10);
    if (r.kind === 'hotel') return start && (date >= start && date <= (end || start));
    return start === date || (r.kind === 'flight' && end === date);
  });
}

const KIND_ICON = { flight: Plane, hotel: BedDouble, ticket: Ticket, other: Ticket } as const;

export function DayReservations({ snap, date }: { snap: Snapshot; date: string }) {
  const setTab = useStore((s) => s.setTab);
  const list = reservationsFor(snap, date);
  return (
    <section className="card aside-card">
      <h2 className="card-title h-stretch">
        <Ticket size={18} /> Reservas del día
      </h2>
      {list.length === 0 ? (
        <p className="muted small">No hay reservas registradas para este día.</p>
      ) : (
        <ul className="mini-list">
          {list.map((r) => {
            const Icon = KIND_ICON[r.kind];
            const t = r.startsAt.includes('T') ? formatTime12(r.startsAt.slice(11, 16)) : '';
            return (
              <li key={r.id}>
                <Icon size={16} />
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {[t, [r.provider, r.flightNo].filter(Boolean).join(' '), r.kind === 'hotel' && r.startsAt.slice(0, 10) === date ? 'Check-in' : r.kind === 'hotel' && r.endsAt.slice(0, 10) === date ? 'Check-out' : ''].filter(Boolean).join(' · ')}
                  </small>
                </div>
                <span className={`dot ${r.status}`} title={r.status === 'booked' ? 'Reservado' : r.status === 'pending' ? 'Pendiente' : 'Por reservar'} />
              </li>
            );
          })}
        </ul>
      )}
      <button className="link-btn" onClick={() => setTab('reservas')}>
        Ver todas las reservas <ArrowRight size={14} />
      </button>
    </section>
  );
}

export function ChecklistPreview({ snap }: { snap: Snapshot }) {
  const setTab = useStore((s) => s.setTab);
  const dispatch = useStore((s) => s.dispatch);
  const pending = snap.checklist.filter((c) => c.list === 'pending');
  const done = pending.filter((c) => c.done).length;
  const todo = pending.filter((c) => !c.done).slice(0, 4);
  return (
    <section className="card aside-card">
      <h2 className="card-title h-stretch">Pendientes antes de viajar</h2>
      <div className="row" style={{ gap: 14 }}>
        <Ring value={pending.length ? done / pending.length : 1} label={`${done}/${pending.length}`} />
        <p className="muted small grow">
          {todo.length === 0 ? '¡Todo listo para despegar!' : `Te faltan ${pending.length - done} cosas por resolver.`}
        </p>
      </div>
      {todo.length > 0 && (
        <ul className="mini-list check-list">
          {todo.map((c) => (
            <motion.li key={c.id} layout>
              <button
                className="mini-check"
                aria-label={`Marcar: ${c.text}`}
                onClick={() => {
                  tap();
                  dispatch({ entity: 'checklist', action: 'patch', id: c.id, data: { done: true } });
                }}
              />
              <span>{c.text}</span>
            </motion.li>
          ))}
        </ul>
      )}
      <button className="link-btn" onClick={() => setTab('pendientes')}>
        Ver lista completa <ArrowRight size={14} />
      </button>
    </section>
  );
}

/** Recordatorios generales para el día: no dependen de la ciudad ni de fechas concretas. */
export function Facts({ city }: { city: City }) {
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches;
  return (
    <details className="card aside-card facts" open={wide}>
      <summary>
        <h2 className="card-title h-stretch">Para tener en cuenta</h2>
        <ChevronDown size={18} className="chev" />
      </summary>
      <div className="facts-body">
        <p>Revisa el pronóstico de {CITY_META[city].name} en la pestaña Clima antes de salir.</p>
        <p>Confirma horarios, precios y requisitos de cada lugar en su sitio oficial: pueden cambiar.</p>
        <small className="muted">{CITY_META[city].name} es la ciudad del día seleccionado.</small>
      </div>
    </details>
  );
}
