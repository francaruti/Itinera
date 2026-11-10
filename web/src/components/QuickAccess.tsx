import { BedDouble, CalendarCheck, Plane, Ticket, Utensils, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { Reservation, Snapshot } from '../../../shared/types';
import { useNow } from '../hooks/useNow';
import { plural } from '../lib/format';
import { upcomingItems, type Upcoming } from '../lib/upcoming';
import { useStore } from '../store';

const KIND_ICON: Record<Upcoming['kind'], LucideIcon> = { flight: Plane, hotel: BedDouble, ticket: Ticket, activity: Utensils };

function summary(snap: Snapshot, kind: 'flight' | 'hotel') {
  const list = snap.reservations.filter((r: Reservation) => r.kind === kind);
  const files = new Set((snap.attachments ?? []).map((a) => a.reservationId));
  const withDoc = list.filter((r) => files.has(r.id) || !!r.confirmation).length;
  const noun = kind === 'flight' ? plural(list.length, 'vuelo', 'vuelos') : plural(list.length, 'hotel', 'hoteles');
  return { count: list.length, text: list.length === 0 ? 'Añade el primero' : withDoc < list.length ? `${noun} · faltan datos` : `${noun} · todo a mano` };
}

/** Fila principal de la pantalla de inicio: vuelos y hoteles a un toque, y lo reservado que se acerca. */
export function QuickAccess({ snap }: { snap: Snapshot }) {
  const openDocs = useStore((s) => s.openDocs);
  const openDetail = useStore((s) => s.openDetail);
  const selectDate = useStore((s) => s.selectDate);
  const now = useNow(60_000);
  const items = useMemo(() => upcomingItems(snap, now), [snap, now]);

  const flights = summary(snap, 'flight');
  const hotels = summary(snap, 'hotel');
  const nextFlight = items.find((i) => i.kind === 'flight');
  const nextHotel = items.find((i) => i.kind === 'hotel');
  const extras = items.filter((i) => i.kind === 'ticket' || i.kind === 'activity').slice(0, 2);

  const setTab = useStore((s) => s.setTab);
  /** Abre la hoja; si por cualquier razón no aparece, lleva a Reservas (nunca se queda «sin pasar nada»). */
  const open = (arg: { kind: 'flight' | 'hotel' | 'ticket'; id?: string }) => {
    openDocs(arg);
    window.setTimeout(() => {
      if (!document.querySelector('.overlay')) {
        useStore.getState().openDocs(null);
        setTab('reservas');
      }
    }, 700);
  };

  const go = (i: Upcoming) => {
    if (i.kind === 'activity') {
      const a = snap.activities.find((x) => x.id === i.id);
      if (a) selectDate(a.dayDate);
      openDetail(i.id);
    } else open({ kind: i.kind, id: i.id });
  };

  return (
    <nav className="qa" aria-label="Accesos directos">
      <button className={`qa-card${nextFlight ? ` alert ${nextFlight.urgency}` : ''}`} onClick={() => open({ kind: 'flight', id: nextFlight?.id })}>
        <span className="qa-ico k-flight">
          <Plane size={20} />
        </span>
        <span className="qa-text">
          <strong>Vuelos</strong>
          <small>{nextFlight ? `${nextFlight.when}${nextFlight.missingDoc ? ' · falta el pase' : ''}` : flights.text}</small>
        </span>
        {nextFlight && <i className="qa-dot" aria-hidden="true" />}
      </button>
      <button className={`qa-card${nextHotel ? ` alert ${nextHotel.urgency}` : ''}`} onClick={() => open({ kind: 'hotel', id: nextHotel?.id })}>
        <span className="qa-ico k-hotel">
          <BedDouble size={20} />
        </span>
        <span className="qa-text">
          <strong>Hoteles</strong>
          <small>{nextHotel ? nextHotel.when : hotels.text}</small>
        </span>
        {nextHotel && <i className="qa-dot" aria-hidden="true" />}
      </button>
      {extras.map((i) => {
        const Icon = KIND_ICON[i.kind] ?? CalendarCheck;
        return (
          <button key={i.key} className={`qa-card alert ${i.urgency}`} onClick={() => go(i)}>
            <span className={`qa-ico k-${i.kind}`}>
              <Icon size={20} />
            </span>
            <span className="qa-text">
              <strong className="clamp-1">{i.title}</strong>
              <small>{i.when}</small>
            </span>
            <i className="qa-dot" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
