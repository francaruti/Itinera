import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, MapPin, MapPinOff, Navigation, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ACTIVITY_CATEGORY_LABEL, cityMeta } from '../../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex } from '../../../../shared/time';
import { ACTIVITY_CATEGORIES, type ActivityCategory, type City, type GeocodeResult } from '../../../../shared/types';
import { api } from '../../lib/api';
import { directionsUrl } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/meta';
import { PLACE_SUGGESTIONS, categoryFromOsm } from '../../lib/osm';
import { op } from '../../lib/ops';
import { photoForActivity } from '../../lib/photos';
import { dayActivities, positionForTime } from '../../lib/selectors';
import { uid } from '../../lib/uid';
import { useStore } from '../../store';
import { Photo } from '../photos/Photo';
import { Sheet } from '../ui/Sheet';

/** Busca un lugar en el mapa y lo añade a un día del itinerario con su ubicación. */
export default function AddPlaceSheet() {
  const snap = useStore((s) => s.snap)!;
  const state = useStore((s) => s.addPlace);
  const close = useStore((s) => s.openAddPlace);
  const dispatch = useStore((s) => s.dispatch);
  const selectDate = useStore((s) => s.selectDate);
  const setTab = useStore((s) => s.setTab);
  const flash = useStore((s) => s.flash);
  const toast = useStore((s) => s.toast);
  const open = !!state;

  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<GeocodeResult | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('sight');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const seq = useRef(0);

  const dayCity = (d: string): City | undefined => snap.days.find((x) => x.date === d)?.city;

  // Al abrir: estado limpio; si viene con consulta, se busca de inmediato.
  useEffect(() => {
    if (!state) return;
    const d = state.date && snap.days.some((x) => x.date === state.date) ? state.date : useStore.getState().selectedDate;
    setDate(d);
    setPicked(null);
    setResults(null);
    setError('');
    setTime('');
    setCost('');
    setNotes('');
    setQ(state.query ?? '');
    if (state.query && state.query.trim().length >= 3) void search(state.query, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function search(text: string, forDate = date) {
    const query = text.trim();
    if (query.length < 3) return;
    const id = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const res = await api.geocode(query, dayCity(forDate));
      if (id !== seq.current) return;
      setResults(res);
    } catch {
      if (id !== seq.current) return;
      setError('No se pudo buscar. Revisa tu conexión e inténtalo de nuevo.');
      setResults(null);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  // Búsqueda automática al dejar de escribir.
  useEffect(() => {
    if (!open || picked) return;
    if (q.trim().length < 3) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => void search(q), 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, picked]);

  function pick(r: GeocodeResult) {
    setPicked(r);
    setName(r.name ?? r.label.split(',')[0]);
    setCategory(categoryFromOsm(r.osm, r.name ?? r.label));
  }

  const preview = useMemo(() => (picked ? photoForActivity({ place: name, text: name }) : null), [picked, name]);
  const cityName = (() => {
    const c = dayCity(date);
    return c ? cityMeta(c).name : '';
  })();

  function add(another: boolean) {
    if (!picked || !name.trim()) return;
    const acts = dayActivities(snap, date);
    const c = Number(cost.replace(',', '.'));
    const id = uid();
    dispatch(
      op.activity.put({
        id,
        dayDate: date,
        position: positionForTime(acts, time),
        time,
        text: name.trim(),
        done: false,
        category,
        place: name.trim(),
        lat: picked.lat,
        lng: picked.lng,
        cost: cost && Number.isFinite(c) && c >= 0 ? c : null,
        booking: 'none',
        url: '',
        notes: notes.trim() || picked.address || '',
      }),
    );
    if (another) {
      toast(`Añadido: ${name.trim()}`, 'success');
      setPicked(null);
      setResults(null);
      setQ('');
      setTime('');
      setCost('');
      setNotes('');
      return;
    }
    selectDate(date);
    setTab('itinerario');
    close(null);
    toast(`Añadido a ${DOW_ES[dowIndex(date)]} ${dayOfMonth(date)}: ${name.trim()}`, 'success');
    setTimeout(() => flash(id), 500);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (picked) add(false);
    else void search(q);
  }

  const suggestionCity = dayCity(date);
  const suggestions = (suggestionCity && PLACE_SUGGESTIONS[suggestionCity]) || [];

  return (
    <Sheet open={open} onClose={() => close(null)} title={picked ? 'Añadir al itinerario' : 'Buscar y añadir un lugar'} wide>
      <form onSubmit={onSubmit}>
        <AnimatePresence mode="wait" initial={false}>
          {!picked ? (
            <motion.div key="search" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="sheet-body">
              <div className="add-search">
                <Search size={18} />
                <input
                  className="input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Busca un lugar${cityName ? ` en ${cityName}` : ''}…  ej. Museo de arte`}
                  aria-label="Buscar lugar"
                  maxLength={120}
                  data-autofocus
                />
                {loading && <Loader2 size={18} className="spin" />}
              </div>

              <label className="field inline-field">
                <span>Día en el que lo añadirás</span>
                <select className="select" value={date} onChange={(e) => setDate(e.target.value)}>
                  {snap.days.map((d) => (
                    <option key={d.date} value={d.date}>
                      {DOW_ES[dowIndex(d.date)].slice(0, 3)} {dayOfMonth(d.date)} · {cityMeta(d.city).name}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p className="field-error">{error}</p>}

              {results === null && !loading && suggestions.length > 0 && (
                <div className="add-suggest">
                  <small className="muted">Ideas en {cityName || 'tu destino'}</small>
                  <div className="row wrap">
                    {suggestions.map((s) => (
                      <button key={s} type="button" className="chip pick" onClick={() => { setQ(s); void search(s); }}>
                        <MapPin size={13} /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.length === 0 && (
                <div className="empty-state">
                  <MapPinOff />
                  <strong>Sin resultados</strong>
                  <span>Prueba con el nombre completo o añade la ciudad (ej. «Joe’s Pizza Manhattan»).</span>
                </div>
              )}

              {results && results.length > 0 && (
                <ul className="place-results" role="listbox" aria-label="Resultados">
                  {results.map((r, i) => {
                    const cat = categoryFromOsm(r.osm, r.name ?? r.label);
                    const Icon = CATEGORY_ICON[cat];
                    return (
                      <motion.li key={`${r.lat},${r.lng},${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                        <button type="button" role="option" aria-selected="false" onClick={() => pick(r)}>
                          <span className={`cat-badge cat-${cat} lg`}>
                            <Icon size={16} />
                          </span>
                          <span className="pr-text">
                            <strong>{r.name}</strong>
                            <small>{r.address || r.label}</small>
                          </span>
                          <Plus size={18} className="pr-add" />
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
              <small className="muted">Resultados de OpenStreetMap. Revisa los detalles antes de añadir.</small>
            </motion.div>
          ) : (
            <motion.div key="details" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }} className="sheet-body">
              <button type="button" className="link-btn back" onClick={() => setPicked(null)}>
                <ArrowLeft size={15} /> Cambiar lugar
              </button>

              <div className="picked-card">
                {preview ? <Photo photo={preview} width={500} className="picked-photo" alt={preview.name} /> : <span className="picked-pin"><MapPin size={22} /></span>}
                <div className="grow">
                  <strong>{picked.name}</strong>
                  <small className="muted">{picked.address || picked.label}</small>
                  <a className="meta-link" href={directionsUrl(picked.lat, picked.lng)} target="_blank" rel="noreferrer">
                    <Navigation size={13} /> Ver cómo llegar
                  </a>
                </div>
              </div>

              <label className="field">
                <span>Nombre en el itinerario</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={500} aria-invalid={!name.trim()} data-autofocus />
              </label>

              <div className="grid-2">
                <label className="field">
                  <span>Día</span>
                  <select className="select" value={date} onChange={(e) => setDate(e.target.value)}>
                    {snap.days.map((d) => (
                      <option key={d.date} value={d.date}>
                        {DOW_ES[dowIndex(d.date)].slice(0, 3)} {dayOfMonth(d.date)} · {cityMeta(d.city).name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Hora (opcional)</span>
                  <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>

              <div className="field">
                <span>Categoría</span>
                <div className="row wrap">
                  {ACTIVITY_CATEGORIES.map((c) => {
                    const Icon = CATEGORY_ICON[c];
                    return (
                      <button key={c} type="button" className="chip pick" aria-pressed={category === c} onClick={() => setCategory(c)}>
                        <Icon size={14} /> {ACTIVITY_CATEGORY_LABEL[c]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid-2">
                <label className="field">
                  <span>Costo estimado (USD, opcional)</span>
                  <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
                </label>
                <label className="field">
                  <span>Notas (opcional)</span>
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reserva, tips…" maxLength={300} />
                </label>
              </div>

              <div className="sheet-foot" style={{ marginTop: 6 }}>
                <button type="button" className="btn ghost" onClick={() => add(true)} disabled={!name.trim()}>
                  <Plus size={16} /> Añadir y buscar otro
                </button>
                <button type="submit" className="btn accent" disabled={!name.trim()}>
                  <Check size={16} /> Añadir al itinerario
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Sheet>
  );
}
