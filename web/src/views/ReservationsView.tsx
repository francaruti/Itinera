import { AnimatePresence, motion } from 'framer-motion';
import { BedDouble, Check, Copy, ExternalLink, MapPin, Paperclip, Plane, Plus, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RESERVATION_KIND_LABEL } from '../../../shared/constants';
import { DOW_ES, MONTH_ES, dayDiff, dayOfMonth, dowIndex, formatTime12, monthIndex } from '../../../shared/time';
import type { Reservation, ReservationKind, ReservationStatus } from '../../../shared/types';
import { ReservationEditor } from '../components/reservations/ReservationEditor';
import { Ring } from '../components/ui/Ring';
import { Seg } from '../components/ui/Seg';
import { celebrate } from '../lib/confetti';
import { tap } from '../lib/haptics';
import { photoForReservation } from '../lib/photos';
import { Photo } from '../components/photos/Photo';
import { copyText, mapsSearchUrl, money } from '../lib/format';
import { op } from '../lib/ops';
import { nextPosition } from '../lib/selectors';
import { uid } from '../lib/uid';
import { Clamp } from '../components/ui/Clamp';
import { useStore } from '../store';

const STATUS_LABEL: Record<ReservationStatus, string> = { booked: 'Reservado', pending: 'Pendiente', todo: 'Por reservar' };
const STATUS_CLASS: Record<ReservationStatus, string> = { booked: 'ok', pending: 'warn', todo: 'todo' };
const NEXT_STATUS: Record<ReservationStatus, ReservationStatus> = { todo: 'pending', pending: 'booked', booked: 'todo' };
const KIND_ORDER: ReservationKind[] = ['flight', 'hotel', 'ticket', 'other'];

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  const t = iso.length > 10 ? formatTime12(iso.slice(11, 16)) : '';
  return `${DOW_ES[dowIndex(d)].slice(0, 3)} ${dayOfMonth(d)} ${MONTH_ES[monthIndex(d)].slice(0, 3)}${t ? ` · ${t}` : ''}`;
}

function CopyCode({ code, onAdd }: { code: string; onAdd(): void }) {
  const toast = useStore((s) => s.toast);
  if (!code)
    return (
      <button className="chip warn" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
        Añadir código
      </button>
    );
  return (
    <button
      className="code-btn"
      onClick={async (e) => {
        e.stopPropagation();
        toast((await copyText(code)) ? 'Código copiado' : 'No se pudo copiar', 'success');
      }}
      aria-label={`Copiar código ${code}`}
    >
      <span className="mono">{code}</span> <Copy size={13} />
    </button>
  );
}

function Card({ r, index, onOpen }: { r: Reservation; index: number; onOpen(): void }) {
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const nFiles = useStore((s) => (s.snap?.attachments ?? []).filter((a) => a.reservationId === r.id).length);

  const cycle = () => {
    tap();
    const status = NEXT_STATUS[r.status];
    dispatch(op.reservation.patch(r.id, { status }));
    toast(`${r.title}: ${STATUS_LABEL[status].toLowerCase()}`, 'success');
  };
  const nights = r.kind === 'hotel' && r.startsAt && r.endsAt ? dayDiff(r.startsAt.slice(0, 10), r.endsAt.slice(0, 10)) : 0;
  const cover = photoForReservation(r);
  const [from, to] = r.kind === 'flight' && r.title.includes('→') ? r.title.split('→').map((s) => s.trim()) : [r.title, ''];

  return (
    <motion.article
      layout
      className={`res res-${r.kind} st-${r.status}`}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ y: -3 }}
    >
      {cover && (
        <div className="res-photo">
          <Photo photo={cover} width={500} alt={cover.name} />
        </div>
      )}
      <div className="res-main" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()} aria-label={`Editar reserva: ${r.title}`}>
        <div className="res-kind">
          {r.kind === 'flight' ? <Plane size={15} /> : r.kind === 'hotel' ? <BedDouble size={15} /> : <Ticket size={15} />}
          {[r.provider, r.flightNo].filter(Boolean).join(' ') || RESERVATION_KIND_LABEL[r.kind].replace(/s$/, '')}
        </div>

        {r.kind === 'flight' && to ? (
          <div className="route-big">
            <strong>{from}</strong>
            <span className="route-line">
              <i />
              <Plane size={16} />
              <i />
            </span>
            <strong>{to}</strong>
          </div>
        ) : (
          <h3 className="res-title">{r.title}</h3>
        )}

        <div className="res-when">
          {r.kind === 'hotel' ? (
            <>
              {fmtDate(r.startsAt)} → {fmtDate(r.endsAt)}
              {nights > 0 && <span className="chip">{nights} {nights === 1 ? 'noche' : 'noches'}</span>}
            </>
          ) : r.kind === 'flight' ? (
            <>
              {fmtDate(r.startsAt) || 'Fecha por definir'}
              {r.endsAt && <span className="muted"> → llega {fmtDate(r.endsAt)}</span>}
            </>
          ) : (
            fmtDate(r.startsAt) || 'Sin fecha'
          )}
        </div>

        {r.address && (
          <a className="meta-link" href={mapsSearchUrl(r.address)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <MapPin size={13} /> <span className="clamp-1">{r.address}</span>
          </a>
        )}
        {r.notes && <Clamp className="res-notes">{r.notes}</Clamp>}
      </div>

      <div className="res-stub">
        <button className={`chip ${STATUS_CLASS[r.status]} status-btn`} onClick={cycle} title="Cambiar estado">
          {r.status === 'booked' && <Check size={13} />} {STATUS_LABEL[r.status]}
        </button>
        <CopyCode code={r.confirmation} onAdd={() => useStore.getState().openDocs({ kind: r.kind === 'flight' ? 'flight' : r.kind === 'hotel' ? 'hotel' : 'ticket', id: r.id })} />
        {nFiles > 0 && (
          <span className="chip" title="Archivos guardados">
            <Paperclip size={12} /> {nFiles}
          </span>
        )}
        <div className="res-foot">
          {r.amount != null && (
            <span className="small tnum">
              {money(r.amount)} {r.paid ? '· pagado' : ''}
            </span>
          )}
          {r.url && (
            <a className="icon-btn sm" href={r.url} target="_blank" rel="noreferrer" aria-label="Abrir enlace" onClick={(e) => e.stopPropagation()}>
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function ReservationsView() {
  const snap = useStore((s) => s.snap)!;
  const dispatch = useStore((s) => s.dispatch);
  const [filter, setFilter] = useState<'all' | 'open' | 'booked'>('all');
  const [editId, setEditId] = useState<string | null>(null);

  const list = useMemo(
    () => [...snap.reservations].sort((a, b) => (a.startsAt || a.endsAt || '9999').localeCompare(b.startsAt || b.endsAt || '9999') || a.position - b.position),
    [snap.reservations],
  );
  const total = list.length;
  const booked = list.filter((r) => r.status === 'booked').length;
  const open = total - booked;
  const filtered = list.filter((r) => (filter === 'all' ? true : filter === 'booked' ? r.status === 'booked' : r.status !== 'booked'));

  function add() {
    const id = uid();
    dispatch(
      op.reservation.put({
        id,
        kind: 'ticket',
        title: 'Nueva reserva',
        provider: '',
        flightNo: '',
        confirmation: '',
        startsAt: '',
        endsAt: '',
        city: snap.days.find((d) => d.date === useStore.getState().selectedDate)?.city ?? 'ny',
        address: '',
        amount: null,
        currency: 'USD',
        status: 'todo',
        paid: false,
        url: '',
        notes: '',
        position: nextPosition(snap.reservations),
      }),
    );
    setEditId(id);
  }

  // Confeti cuando todo queda reservado.
  const allBooked = total > 0 && open === 0;
  const [seenAll, setSeenAll] = useState(allBooked);
  if (allBooked && !seenAll) {
    setSeenAll(true);
    setTimeout(() => celebrate(), 200);
  } else if (!allBooked && seenAll) setSeenAll(false);

  return (
    <div className="container">
      <header className="view-head">
        <div>
          <h1 className="display view-title">Reservas</h1>
          <p className="muted">Toca el estado de una reserva para cambiarlo.</p>
        </div>
        <div className="view-head-side">
          <Ring value={total ? booked / total : 0} size={72} label={`${booked}/${total}`} />
          <button className="btn" onClick={() => useStore.getState().openDocs({ kind: 'flight' })}>
            <Ticket size={18} /> Ver como tarjetas
          </button>
          <button className="btn accent" onClick={add}>
            <Plus size={18} /> Nueva reserva
          </button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat ok">
          <strong>{booked}</strong>
          <span>Reservadas</span>
        </div>
        <div className="stat todo">
          <strong>{open}</strong>
          <span>Por resolver</span>
        </div>
      </div>

      <div className="filter-row">
        <Seg
          value={filter}
          onChange={(v) => setFilter(v)}
          label="Filtrar reservas"
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'open', label: `Por resolver (${open})` },
            { value: 'booked', label: `Reservadas (${booked})` },
          ]}
        />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state card">
          <Ticket />
          <strong>{total === 0 ? 'Aún no hay reservas' : 'No hay reservas en este filtro'}</strong>
          <span>Añade vuelos, hoteles y entradas para tenerlos a mano.</span>
        </div>
      )}

      {KIND_ORDER.map((kind) => {
        const items = filtered.filter((r) => r.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} className="res-section">
            <h2 className="h-stretch res-section-title">
              {RESERVATION_KIND_LABEL[kind]} <span className="chip">{items.length}</span>
            </h2>
            <div className="res-grid">
              <AnimatePresence mode="popLayout">
                {items.map((r, i) => (
                  <Card key={r.id} r={r} index={i} onOpen={() => setEditId(r.id)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        );
      })}

      <ReservationEditor id={editId} onClose={() => setEditId(null)} />
    </div>
  );
}
