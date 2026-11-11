import { Copy, Loader2, MapPinOff, Navigation, Search, Trash2 } from 'lucide-react';
import { uid } from '../../lib/uid';
import { useEffect, useState } from 'react';
import { ACTIVITY_CATEGORY_LABEL, cityMeta } from '../../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex } from '../../../../shared/time';
import { ACTIVITY_CATEGORIES, type Activity, type BookingStatus, type GeocodeResult } from '../../../../shared/types';
import { api } from '../../lib/api';
import { directionsUrl } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/meta';
import { op } from '../../lib/ops';
import { nextPosition } from '../../lib/selectors';
import { useStore } from '../../store';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';

const BOOKING_OPTIONS: Array<{ value: BookingStatus; label: string }> = [
  { value: 'none', label: 'Sin reserva' },
  { value: 'todo', label: 'Por reservar' },
  { value: 'booked', label: 'Reservada' },
];

const validUrl = (v: string) => v === '' || /^https?:\/\//i.test(v);

export function ActivityEditor({ id, onClose }: { id: string | null; onClose(): void }) {
  const snap = useStore((s) => s.snap);
  const dispatch = useStore((s) => s.dispatch);
  const removeWithUndo = useStore((s) => s.removeWithUndo);
  const a = snap?.activities.find((x) => x.id === id) ?? null;

  // Borradores locales para campos que podrían quedar inválidos mientras se escribe.
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [cost, setCost] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (a) {
      setText(a.text);
      setUrl(a.url);
      setCost(a.cost == null ? '' : String(a.cost));
    }
    setResults(null);
    setSearchError('');
    // Solo al abrir otra actividad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = (data: Partial<Activity>) => a && dispatch(op.activity.patch(a.id, data));

  async function locate() {
    if (!a || !a.place.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const city = snap?.days.find((d) => d.date === a.dayDate)?.city;
      const q = city ? `${a.place}, ${cityMeta(city).name}` : a.place;
      setResults(await api.geocode(q));
    } catch {
      setSearchError('No se pudo buscar. Revisa tu conexión.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function duplicate() {
    if (!a) return;
    const id = uid();
    dispatch(op.activity.put({ ...a, id, position: a.position + 0.5, done: false }));
    useStore.getState().toast('Actividad duplicada', 'success');
    onClose();
    setTimeout(() => useStore.getState().flash(id), 300);
  }

  function remove() {
    if (!a || !snap) return;
    const restore = op.activity.put(a);
    onClose();
    removeWithUndo('Actividad eliminada', op.activity.del(a.id), restore);
  }

  return (
    <Sheet open={!!a} onClose={onClose} title="Editar actividad" wide>
      {a && snap && (
        <>
          <div className="sheet-body">
            <label className="field">
              <span>Actividad</span>
              <input
                className="input"
                value={text}
                maxLength={500}
                aria-invalid={text.trim() === ''}
                onChange={(e) => {
                  setText(e.target.value);
                  if (e.target.value.trim()) patch({ text: e.target.value });
                }}
              />
              {text.trim() === '' && <small className="field-error">La actividad no puede estar vacía.</small>}
            </label>

            <div className="grid-2">
              <label className="field">
                <span>Hora</span>
                <input className="input" type="time" value={a.time} onChange={(e) => patch({ time: e.target.value })} />
              </label>
              <label className="field">
                <span>Día</span>
                <select
                  className="select"
                  value={a.dayDate}
                  onChange={(e) => {
                    const target = snap.activities.filter((x) => x.dayDate === e.target.value);
                    patch({ dayDate: e.target.value, position: nextPosition(target) });
                  }}
                >
                  {snap.days.map((d) => (
                    <option key={d.date} value={d.date}>
                      {DOW_ES[dowIndex(d.date)].slice(0, 3)} {dayOfMonth(d.date)} · {cityMeta(d.city).name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field">
              <span>Categoría</span>
              <div className="row wrap">
                {ACTIVITY_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <button key={c} type="button" className="chip pick" aria-pressed={a.category === c} onClick={() => patch({ category: c })}>
                      <Icon size={14} /> {ACTIVITY_CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <span>Lugar</span>
              <div className="row">
                <input
                  className="input grow"
                  value={a.place}
                  maxLength={200}
                  placeholder="Ej. Museo de arte"
                  onChange={(e) => patch({ place: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void locate();
                    }
                  }}
                />
                <button type="button" className="btn ghost" onClick={locate} disabled={!a.place.trim() || searching}>
                  {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Ubicar
                </button>
              </div>
              {searchError && <small className="field-error">{searchError}</small>}
              {results && results.length === 0 && <small className="muted">Sin resultados. Prueba con otro nombre.</small>}
              {results && results.length > 0 && (
                <ul className="geo-results">
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lng}`}>
                      <button
                        type="button"
                        onClick={() => {
                          patch({ lat: r.lat, lng: r.lng });
                          setResults(null);
                        }}
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {a.lat != null && a.lng != null && (
                <div className="row geo-status">
                  <span className="chip ok">
                    <Navigation size={12} /> En el mapa
                  </span>
                  <a className="meta-link" href={directionsUrl(a.lat, a.lng)} target="_blank" rel="noreferrer">
                    Cómo llegar
                  </a>
                  <button type="button" className="meta-link as-btn" onClick={() => patch({ lat: null, lng: null })}>
                    <MapPinOff size={13} /> Quitar ubicación
                  </button>
                </div>
              )}
            </div>

            <div className="field">
              <span>Reserva</span>
              <Seg value={a.booking} options={BOOKING_OPTIONS} onChange={(v) => patch({ booking: v })} label="Estado de la reserva" />
            </div>

            <div className="grid-2">
              <label className="field">
                <span>Costo estimado (USD)</span>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="0"
                  value={cost}
                  onChange={(e) => {
                    setCost(e.target.value);
                    const n = Number(e.target.value.replace(',', '.'));
                    if (e.target.value === '') patch({ cost: null });
                    else if (Number.isFinite(n) && n >= 0) patch({ cost: n });
                  }}
                />
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
                {!validUrl(url) && <small className="field-error">Debe empezar con http:// o https://</small>}
              </label>
            </div>

            <label className="field">
              <span>Notas</span>
              <textarea className="textarea" value={a.notes} maxLength={3000} placeholder="Dirección, código de reserva, tips…" onChange={(e) => patch({ notes: e.target.value })} />
            </label>
          </div>

          <div className="sheet-foot">
            <div className="row">
              <button className="btn danger" onClick={remove}>
                <Trash2 size={16} /> Eliminar
              </button>
              <button className="btn ghost" onClick={duplicate}>
                <Copy size={16} /> Duplicar
              </button>
            </div>
            <button className="btn" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
