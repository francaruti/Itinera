import { ArrowLeft, Copy, ExternalLink, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Reservation, ReservationStatus } from '../../../../shared/types';
import { copyText } from '../../lib/format';
import { op } from '../../lib/ops';
import { nextPosition } from '../../lib/selectors';
import { uid } from '../../lib/uid';
import { useStore } from '../../store';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { AttachmentStrip } from './Attachments';
import type { FieldKey } from '../../lib/completeness';
import { WalletCard } from './WalletCard';
import { WalletCarousel, type Slide } from './WalletCarousel';

type Tab = 'flight' | 'hotel' | 'ticket';
const TAB_LABEL: Record<Tab, string> = { flight: 'Vuelos', hotel: 'Hoteles', ticket: 'Entradas' };
const ADD_LABEL: Record<Tab, string> = { flight: 'Añadir vuelo', hotel: 'Añadir hotel', ticket: 'Añadir entrada' };
const EMPTY: Record<Tab, { title: string; text: string }> = {
  flight: { title: 'Aún no hay vuelos', text: 'Guarda aquí tu pase de abordar, número de vuelo y reserva.' },
  hotel: { title: 'Aún no hay hoteles', text: 'Guarda la captura de Booking, el número de reserva y el enlace.' },
  ticket: { title: 'Aún no hay entradas', text: 'Guarda tus entradas, reservas de restaurantes y atracciones.' },
};
const DOC_LABEL: Record<Tab, string> = { flight: 'Pases de abordar y reservas (capturas o PDF)', hotel: 'Reserva (captura o PDF)', ticket: 'Entradas y reservas (capturas o PDF)' };
const LINK_HINT: Record<Tab, string> = { flight: 'Enlace de la reserva (aerolínea)', hotel: 'Enlace de la reserva (Booking)', ticket: 'Enlace de la reserva' };
const NOTES_HINT: Record<Tab, string> = {
  flight: 'Equipaje, asiento, terminal, hora de llegada al aeropuerto…',
  hotel: 'Check-in temprano, tarifa de resort, parqueadero, habitación…',
  ticket: 'Hora de ingreso, puerta, qué llevar…',
};
const STATUS: Array<{ value: ReservationStatus; label: string }> = [
  { value: 'todo', label: 'Por reservar' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'booked', label: 'Reservado' },
];

const validUrl = (v: string) => v === '' || /^https?:\/\//i.test(v);
const inTab = (r: Reservation, tab: Tab) => (tab === 'ticket' ? r.kind === 'ticket' || r.kind === 'other' : r.kind === tab);
const tabOf = (r: Reservation): Tab => (r.kind === 'flight' ? 'flight' : r.kind === 'hotel' ? 'hotel' : 'ticket');

/** Formulario de una reserva: todo lo que se puede completar, bien ordenado. */
function ResForm({ r, tab, focus }: { r: Reservation; tab: Tab; focus?: FieldKey }) {
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const root = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ title: r.title, provider: r.provider, flightNo: r.flightNo ?? '', confirmation: r.confirmation, url: r.url, notes: r.notes, address: r.address });
  const patch = (data: Partial<Reservation>) => dispatch(op.reservation.patch(r.id, data));

  // Se vuelve a leer lo que llegue de otro dispositivo, salvo el campo que se está escribiendo.
  useEffect(() => {
    setV((cur) => {
      const active = document.activeElement?.id ?? '';
      const next = { title: r.title, provider: r.provider, flightNo: r.flightNo ?? '', confirmation: r.confirmation, url: r.url, notes: r.notes, address: r.address };
      const ids: Record<string, string> = { title: `t-${r.id}`, provider: `p-${r.id}`, flightNo: `f-${r.id}`, confirmation: `c-${r.id}`, url: `u-${r.id}`, notes: `n-${r.id}`, address: `a-${r.id}` };
      const merged = { ...next };
      for (const k of Object.keys(next) as Array<keyof typeof next>) if (active === ids[k]) merged[k] = cur[k];
      return merged;
    });
  }, [r.title, r.provider, r.flightNo, r.confirmation, r.url, r.notes, r.address, r.id]);

  // Si se llegó desde una casilla «Añadir…», se enfoca ese campo.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const idFor: Partial<Record<FieldKey, string>> = { provider: `p-${r.id}`, flightNo: `f-${r.id}`, confirmation: `c-${r.id}`, url: `u-${r.id}`, dates: `d1-${r.id}`, address: `a-${r.id}` };
      const el = focus === 'files' ? root.current?.querySelector<HTMLElement>('.att') : document.getElementById(idFor[focus] ?? '');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (focus !== 'files') (el as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 250);
    return () => clearTimeout(t);
  }, [focus, r.id]);

  const set = <K extends keyof typeof v>(key: K, value: string, field: Partial<Reservation>) => {
    setV((s) => ({ ...s, [key]: value }));
    patch(field);
  };
  const hotel = r.kind === 'hotel';
  const dateType = hotel ? 'date' : 'datetime-local';
  const dateVal = (iso: string) => (hotel ? iso.slice(0, 10) : iso.length === 10 ? '' : iso);

  return (
    <div ref={root} className="rf">
      <label className="field">
        <span>{tab === 'flight' ? 'Ruta' : 'Nombre'}</span>
        <input id={`t-${r.id}`} className="input" value={v.title} maxLength={200} placeholder={tab === 'flight' ? 'Origen → destino' : 'Nombre de la reserva'} onChange={(e) => e.target.value.trim() && set('title', e.target.value, { title: e.target.value })} />
        {tab === 'flight' && <small className="muted">Usa «→» para separar origen y destino.</small>}
      </label>

      <div className={tab === 'flight' ? 'doc-pair' : 'doc-field'}>
        <label className="field">
          <span>{tab === 'flight' ? 'Aerolínea' : tab === 'hotel' ? 'Plataforma / cadena' : 'Proveedor'}</span>
          <input id={`p-${r.id}`} className="input" value={v.provider} maxLength={120} placeholder={tab === 'flight' ? 'Ej. Aerolínea' : tab === 'hotel' ? 'Ej. Sitio de reservas' : ''} onChange={(e) => set('provider', e.target.value, { provider: e.target.value })} />
        </label>
        {tab === 'flight' && (
          <label className="field">
            <span>Número de vuelo</span>
            <input id={`f-${r.id}`} className="input mono" value={v.flightNo} maxLength={40} placeholder="Ej. B6 83" autoCapitalize="characters" onChange={(e) => set('flightNo', e.target.value.toUpperCase(), { flightNo: e.target.value.toUpperCase() })} />
          </label>
        )}
      </div>

      <div className="doc-pair">
        <label className="field">
          <span>{hotel ? 'Check-in' : tab === 'flight' ? 'Salida' : 'Fecha y hora'}</span>
          <input id={`d1-${r.id}`} className="input" type={dateType} value={dateVal(r.startsAt)} onChange={(e) => patch({ startsAt: e.target.value })} />
        </label>
        {tab !== 'ticket' && (
          <label className="field">
            <span>{hotel ? 'Check-out' : 'Llegada'}</span>
            <input id={`d2-${r.id}`} className="input" type={dateType} value={dateVal(r.endsAt)} onChange={(e) => patch({ endsAt: e.target.value })} />
          </label>
        )}
      </div>

      {hotel && (
        <label className="field">
          <span>Dirección</span>
          <input id={`a-${r.id}`} className="input" value={v.address} maxLength={300} onChange={(e) => set('address', e.target.value, { address: e.target.value })} />
        </label>
      )}

      <label className="field">
        <span>Número de reserva</span>
        <div className="doc-row">
          <input id={`c-${r.id}`} className="input mono" value={v.confirmation} maxLength={80} placeholder="Ej. ABC123" autoCapitalize="characters" onChange={(e) => set('confirmation', e.target.value.toUpperCase(), { confirmation: e.target.value.toUpperCase() })} />
          <button
            type="button"
            className="btn icon"
            disabled={!v.confirmation}
            aria-label="Copiar número de reserva"
            onClick={async () => toast((await copyText(v.confirmation)) ? 'Número copiado' : 'No se pudo copiar', 'success')}
          >
            <Copy size={16} />
          </button>
        </div>
      </label>

      <label className="field">
        <span>{LINK_HINT[tab]}</span>
        <input id={`u-${r.id}`} className="input" type="url" inputMode="url" placeholder="Pega aquí el enlace" value={v.url} aria-invalid={!validUrl(v.url)} onChange={(e) => (setV((s) => ({ ...s, url: e.target.value })), validUrl(e.target.value) && patch({ url: e.target.value }))} />
        {r.url && (
          <a className="btn accent doc-open" href={r.url} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Abrir reserva
          </a>
        )}
      </label>

      <div className="doc-field">
        <span className="doc-label">{DOC_LABEL[tab]}</span>
        <AttachmentStrip r={r} addLabel={tab === 'flight' ? 'Añadir pase de abordar (foto o PDF)' : 'Añadir captura o PDF'} />
      </div>

      <label className="field">
        <span>Notas y observaciones</span>
        <textarea id={`n-${r.id}`} className="textarea doc-notes" rows={3} maxLength={3000} value={v.notes} placeholder={NOTES_HINT[tab]} onChange={(e) => set('notes', e.target.value, { notes: e.target.value })} />
      </label>

      <div className="doc-field">
        <span className="doc-label">Estado</span>
        <Seg value={r.status} options={STATUS} onChange={(s) => patch({ status: s })} label="Estado de la reserva" />
      </div>
    </div>
  );
}

function DocsBody({ docs }: { docs: NonNullable<ReturnType<typeof useStore.getState>['docs']> }) {
  const snap = useStore((s) => s.snap);
  const dispatch = useStore((s) => s.dispatch);
  const [tab, setTab] = useState<Tab>(docs.kind);
  const [detail, setDetail] = useState<{ id: string; field?: FieldKey } | null>(null);
  const [flipped, setFlipped] = useState<{ id: string; field?: FieldKey } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(docs.id ?? null);
  const reservations = snap?.reservations;
  const attachments = snap?.attachments;

  const list = useMemo(
    () =>
      (reservations ?? [])
        .filter((r) => inTab(r, tab))
        .sort((a, b) => (a.startsAt || a.endsAt || '9999').localeCompare(b.startsAt || b.endsAt || '9999') || a.position - b.position),
    [reservations, tab],
  );
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { flight: 0, hotel: 0, ticket: 0 };
    for (const r of reservations ?? []) c[tabOf(r)]++;
    return c;
  }, [reservations]);
  const filesBy = useMemo(() => {
    const m = new Map<string, NonNullable<typeof attachments>>();
    for (const a of attachments ?? []) m.set(a.reservationId, [...(m.get(a.reservationId) ?? []), a]);
    return m;
  }, [attachments]);

  const slides = useMemo<Slide[]>(() => {
    const cards: Slide[] = list.map((r, i) => ({
      key: r.id,
      node: (
        <WalletCard
          r={r}
          files={filesBy.get(r.id) ?? NO_FILES}
          active={activeId === r.id || (activeId === null && i === 0)}
          flipped={flipped?.id === r.id}
          focus={flipped?.id === r.id ? flipped.field : undefined}
          onFlip={(field) => setFlipped({ id: r.id, field })}
          onUnflip={() => setFlipped(null)}
          onMore={(id) => setDetail({ id })}
        />
      ),
    }));
    cards.push({
      key: '__add',
      node: (
        <button type="button" className="wz-add" onClick={() => addRef.current()}>
          <span>
            <Plus size={26} />
          </span>
          <strong>{ADD_LABEL[tab]}</strong>
          <small>{EMPTY[tab].text}</small>
        </button>
      ),
    });
    return cards;
  }, [list, filesBy, flipped, activeId, tab]);

  if (!snap) return null;
  const current = detail ? reservations?.find((r) => r.id === detail.id) : null;

  const addRef = useRef<() => void>(() => undefined);
  addRef.current = add;
  function add() {
    const id = uid();
    dispatch(
      op.reservation.put({
        id,
        kind: tab,
        title: tab === 'flight' ? 'Nuevo vuelo' : tab === 'hotel' ? 'Nuevo hotel' : 'Nueva entrada',
        provider: '',
        flightNo: '',
        confirmation: '',
        startsAt: '',
        endsAt: '',
        city: snap!.days.find((d) => d.date === useStore.getState().selectedDate)?.city ?? 'ny',
        address: '',
        amount: null,
        currency: 'USD',
        status: 'todo',
        paid: false,
        url: '',
        notes: '',
        position: nextPosition(snap!.reservations),
      }),
    );
    setDetail({ id });
  }

  if (current) {
    return (
      <div className="sheet-body">
        <button type="button" className="rf-back" onClick={() => setDetail(null)}>
          <ArrowLeft size={16} /> Volver a {TAB_LABEL[tabOf(current)].toLowerCase()}
        </button>
        <h3 className="rf-title clamp-2">{current.title}</h3>
        <ResForm r={current} tab={tabOf(current)} focus={detail?.field} />
        <button type="button" className="btn accent wc-add" onClick={() => setDetail(null)}>
          Listo
        </button>
      </div>
    );
  }

  return (
    <div className="sheet-body" tabIndex={-1} data-autofocus>
      <Seg<Tab> value={tab} onChange={setTab} label="Tipo de reserva" options={(['flight', 'hotel', 'ticket'] as Tab[]).map((t) => ({ value: t, label: `${TAB_LABEL[t]} (${counts[t]})` }))} />
      <WalletCarousel key={tab} label={TAB_LABEL[tab]} slides={slides} initialKey={docs.id && list.some((r) => r.id === docs.id) ? docs.id : undefined} onActive={(_, key) => (setFlipped(null), setActiveId(key))} />
    </div>
  );
}
const NO_FILES: never[] = [];

/** «Mis reservas»: tarjetas de vuelos, hoteles y entradas con lo esencial a la vista. */
export function DocsSheet() {
  const docs = useStore((s) => s.docs);
  const openDocs = useStore((s) => s.openDocs);
  // Mientras la hoja se cierra se sigue mostrando lo último (sin trabajo extra cuando está cerrada).
  const last = useRef(docs);
  if (docs) last.current = docs;
  const shown = docs ?? last.current;
  return (
    <Sheet open={!!docs} onClose={() => openDocs(null)} title="Mis reservas" wide>
      {shown && <DocsBody key={docs ? 'open' : 'closed'} docs={shown} />}
    </Sheet>
  );
}
