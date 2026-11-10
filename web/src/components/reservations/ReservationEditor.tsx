import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CITY_META, RESERVATION_KIND_LABEL } from '../../../../shared/constants';
import { RESERVATION_KINDS, type Reservation, type ReservationStatus } from '../../../../shared/types';
import { op } from '../../lib/ops';
import { useStore } from '../../store';
import { Seg } from '../ui/Seg';
import { AttachmentStrip } from './Attachments';
import { Sheet } from '../ui/Sheet';

const STATUS: Array<{ value: ReservationStatus; label: string }> = [
  { value: 'todo', label: 'Por reservar' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'booked', label: 'Reservado' },
];
const validUrl = (v: string) => v === '' || /^https?:\/\//i.test(v);

export function ReservationEditor({ id, onClose }: { id: string | null; onClose(): void }) {
  const r = useStore((s) => s.snap?.reservations.find((x) => x.id === id) ?? null);
  const dispatch = useStore((s) => s.dispatch);
  const removeWithUndo = useStore((s) => s.removeWithUndo);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (r) {
      setTitle(r.title);
      setUrl(r.url);
      setAmount(r.amount == null ? '' : String(r.amount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = (data: Partial<Reservation>) => r && dispatch(op.reservation.patch(r.id, data));
  const dateOnly = r?.kind === 'hotel';

  function remove() {
    if (!r) return;
    const restore = op.reservation.put(r);
    onClose();
    removeWithUndo('Reserva eliminada', op.reservation.del(r.id), restore);
  }

  return (
    <Sheet open={!!r} onClose={onClose} title="Reserva" wide>
      {r && (
        <>
          <div className="sheet-body">
            <div className="field">
              <span>Tipo</span>
              <div className="row wrap">
                {RESERVATION_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip pick"
                    aria-pressed={r.kind === k}
                    onClick={() => patch({ kind: k, startsAt: k === 'hotel' ? r.startsAt.slice(0, 10) : r.startsAt, endsAt: k === 'hotel' ? r.endsAt.slice(0, 10) : r.endsAt })}
                  >
                    {RESERVATION_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Título</span>
              <input
                className="input"
                value={title}
                maxLength={200}
                aria-invalid={!title.trim()}
                placeholder={r.kind === 'flight' ? 'Origen → destino' : 'Nombre de la reserva'}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) patch({ title: e.target.value });
                }}
              />
              {r.kind === 'flight' && <small className="muted">Usa “→” para separar origen y destino.</small>}
            </label>

            <div className="grid-2">
              <label className="field">
                <span>{r.kind === 'flight' ? 'Aerolínea' : r.kind === 'hotel' ? 'Plataforma / cadena' : 'Proveedor'}</span>
                <input className="input" value={r.provider} maxLength={120} onChange={(e) => patch({ provider: e.target.value })} />
              </label>
              {r.kind === 'flight' && (
                <label className="field">
                  <span>Número de vuelo</span>
                  <input className="input mono" value={r.flightNo} maxLength={40} placeholder="Ej. B6 83" onChange={(e) => patch({ flightNo: e.target.value.toUpperCase() })} />
                </label>
              )}
            </div>
            <div className="grid-2">
              <label className="field">
                <span>Código de confirmación</span>
                <input className="input mono" value={r.confirmation} maxLength={80} onChange={(e) => patch({ confirmation: e.target.value.toUpperCase() })} />
              </label>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>{r.kind === 'hotel' ? 'Check-in' : r.kind === 'flight' ? 'Salida' : 'Inicio'}</span>
                <input
                  className="input"
                  type={dateOnly ? 'date' : 'datetime-local'}
                  value={dateOnly ? r.startsAt.slice(0, 10) : r.startsAt.length === 10 ? '' : r.startsAt}
                  onChange={(e) => patch({ startsAt: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{r.kind === 'hotel' ? 'Check-out' : r.kind === 'flight' ? 'Llegada' : 'Fin'}</span>
                <input
                  className="input"
                  type={dateOnly ? 'date' : 'datetime-local'}
                  value={dateOnly ? r.endsAt.slice(0, 10) : r.endsAt.length === 10 ? '' : r.endsAt}
                  onChange={(e) => patch({ endsAt: e.target.value })}
                />
              </label>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>Ciudad</span>
                <select className="select" value={r.city} onChange={(e) => patch({ city: e.target.value as Reservation['city'] })}>
                  {Object.entries(CITY_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Dirección</span>
                <input className="input" value={r.address} maxLength={300} onChange={(e) => patch({ address: e.target.value })} />
              </label>
            </div>

            <div className="field">
              <span>Estado</span>
              <Seg value={r.status} options={STATUS} onChange={(v) => patch({ status: v })} label="Estado de la reserva" />
            </div>

            <div className="grid-2">
              <label className="field">
                <span>Monto</span>
                <div className="row">
                  <input
                    className="input grow"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      const n = Number(e.target.value.replace(',', '.'));
                      if (e.target.value === '') patch({ amount: null });
                      else if (Number.isFinite(n) && n >= 0) patch({ amount: n });
                    }}
                  />
                  <span className="muted small">USD</span>
                </div>
              </label>
              <label className="field">
                <span>Enlace</span>
                <input
                  className="input"
                  type="url"
                  placeholder="https://…"
                  value={url}
                  aria-invalid={!validUrl(url)}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (validUrl(e.target.value)) patch({ url: e.target.value });
                  }}
                />
              </label>
            </div>

            <label className="check-line">
              <input type="checkbox" checked={r.paid} onChange={(e) => patch({ paid: e.target.checked })} />
              <span>Pagado</span>
            </label>

            <div className="field">
              <span>Capturas y PDF</span>
              <AttachmentStrip r={r} addLabel={r.kind === 'flight' ? 'Añadir pase de abordar (foto o PDF)' : 'Añadir captura o PDF'} />
            </div>

            <label className="field">
              <span>Notas</span>
              <textarea className="textarea" value={r.notes} maxLength={3000} onChange={(e) => patch({ notes: e.target.value })} />
            </label>
          </div>
          <div className="sheet-foot">
            <button className="btn danger" onClick={remove}>
              <Trash2 size={16} /> Eliminar
            </button>
            <button className="btn" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
