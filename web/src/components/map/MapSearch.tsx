import { Coffee, CreditCard, Hotel, Loader2, MapPin, MapPinned, Pill, Search, Sparkles, TrainFront, Utensils, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, City, GeocodeResult } from '../../../../shared/types';
import { api } from '../../lib/api';
import { CATALOG } from '../../lib/catalog';
import { formatDistance, kmBetween, type LatLng } from '../../lib/geo';
import { CATEGORY_ICON } from '../../lib/meta';
import type { Dest } from './types';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const QUICK: Array<{ label: string; q: string; icon: LucideIcon }> = [
  { label: 'Comer', q: 'restaurant', icon: Utensils },
  { label: 'Café', q: 'cafe', icon: Coffee },
  { label: 'Metro', q: 'subway station', icon: TrainFront },
  { label: 'Farmacia', q: 'pharmacy', icon: Pill },
  { label: 'Cajero', q: 'atm', icon: CreditCard },
  { label: 'Hotel', q: 'hotel', icon: Hotel },
];

interface Item {
  key: string;
  group: 'trip' | 'catalog' | 'net';
  title: string;
  sub: string;
  icon: LucideIcon;
  dest: Dest;
}

interface Props {
  /** Todas las actividades del viaje con coordenadas (para buscarlas por nombre). */
  trip: Activity[];
  city: City;
  /** Dónde está la persona, si se sabe. */
  me: LatLng | null;
  /** Centro actual del mapa (para «cerca de aquí» cuando no hay ubicación). */
  getCenter(): LatLng;
  onPick(d: Dest): void;
  onPin(): void;
  pinning: boolean;
}

/** Buscador del mapa: primero lo del viaje, luego lugares recomendados y, por último, cualquier lugar del mundo (OpenStreetMap). */
export function MapSearch({ trip, city, me, getCenter, onPick, onPin, pinning }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [net, setNet] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const around = me ?? null;

  const nq = norm(q);
  const local = useMemo<Item[]>(() => {
    if (nq.length < 2) return [];
    const out: Item[] = [];
    const seen = new Set<string>();
    for (const a of trip) {
      if (a.lat == null || a.lng == null) continue;
      if (norm(`${a.text} ${a.place}`).includes(nq)) {
        const k = `${a.place || a.text}|${a.lat.toFixed(4)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ key: `t-${a.id}`, group: 'trip', title: a.place || a.text, sub: a.place ? a.text : 'En tu plan', icon: CATEGORY_ICON[a.category], dest: { name: a.place || a.text, lat: a.lat, lng: a.lng, source: 'stop', activityId: a.id } });
      }
      if (out.length >= 5) break;
    }
    let cat = 0;
    for (const p of CATALOG) {
      if (cat >= 5) break;
      if (norm(`${p.name} ${(p.aliases ?? []).join(' ')}`).includes(nq)) {
        const k = `${p.name}|${p.lat.toFixed(4)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        cat++;
        out.push({ key: `c-${p.id}`, group: 'catalog', title: p.name, sub: p.address || 'Recomendado', icon: Sparkles, dest: { name: p.name, address: p.address, lat: p.lat, lng: p.lng, source: 'catalog' } });
      }
    }
    return out;
  }, [nq, trip]);

  // Búsqueda en OpenStreetMap con pausa al escribir
  useEffect(() => {
    setErr('');
    if (nq.length < 3) {
      setNet([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setNet(await api.geocode(q.trim(), city, undefined));
      } catch {
        setErr('No se pudo buscar en el mapa (¿sin conexión?).');
        setNet([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q, nq, city]);

  const origin = around ?? getCenter();
  const netItems = useMemo<Item[]>(
    () =>
      net
        .map((r) => ({ r, km: kmBetween(origin, r) }))
        .sort((x, y) => x.km - y.km)
        .map(({ r }) => ({ key: `n-${r.lat},${r.lng}`, group: 'net' as const, title: r.name ?? r.label, sub: r.address || r.label, icon: MapPin, dest: { name: r.name ?? r.label, address: r.address, lat: r.lat, lng: r.lng, source: 'search' as const } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net],
  );
  const items = useMemo(() => [...local, ...netItems], [local, netItems]);
  useEffect(() => setActive(0), [q]);

  // cerrar al tocar fuera
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function pick(i: Item) {
    onPick(i.dest);
    setQ('');
    setOpen(false);
    input.current?.blur();
  }

  async function quick(qq: string, label: string) {
    setLoading(true);
    setErr('');
    setQ(label);
    try {
      const center = me ?? getCenter();
      setNet(await api.geocode(qq, undefined, center));
    } catch {
      setErr('No se pudo buscar cerca de ti (¿sin conexión?).');
      setNet([]);
    } finally {
      setLoading(false);
    }
  }

  const distLabel = (d: Dest) => (me ? formatDistance(kmBetween(me, d) * 1000) : '');
  const showPanel = open && (q.length > 0 || true);
  const quickMode = nq.length < 2 && net.length === 0;

  return (
    <div className="ms" ref={box}>
      <div className={`ms-bar${open ? ' open' : ''}`}>
        <Search size={18} className="ms-ico" />
        <input
          ref={input}
          className="ms-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar destino…"
          aria-label="Buscar un destino"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && items[active]) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              input.current?.blur();
            }
          }}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="ms-list"
        />
        {loading && <Loader2 size={16} className="spin ms-spin" />}
        {q && (
          <button type="button" className="ms-clear" aria-label="Borrar búsqueda" onClick={() => (setQ(''), setNet([]), input.current?.focus())}>
            <X size={16} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="ms-panel" id="ms-list" role="listbox">
          {quickMode && (
            <>
              <p className="ms-title">{me ? 'Cerca de ti' : 'Cerca de esta zona del mapa'}</p>
              <div className="ms-chips">
                {QUICK.map((c) => (
                  <button key={c.q} type="button" className="ms-chip" onClick={() => void quick(c.q, c.label)}>
                    <c.icon size={15} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {(['trip', 'catalog', 'net'] as const).map((g) => {
            const list = items.filter((i) => i.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g}>
                <p className="ms-title">{g === 'trip' ? 'En tu viaje' : g === 'catalog' ? 'Recomendados' : 'En el mapa'}</p>
                {list.map((i) => {
                  const idx = items.indexOf(i);
                  return (
                    <button key={i.key} type="button" role="option" aria-selected={idx === active} className={`ms-item${idx === active ? ' on' : ''}`} onMouseEnter={() => setActive(idx)} onClick={() => pick(i)}>
                      <span className={`ms-badge ${g}`}>
                        <i.icon size={16} />
                      </span>
                      <span className="ms-text">
                        <strong className="clamp-1">{i.title}</strong>
                        <small className="clamp-1">{i.sub}</small>
                      </span>
                      {distLabel(i.dest) && <span className="ms-dist">{distLabel(i.dest)}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {nq.length >= 3 && !loading && items.length === 0 && !err && <p className="ms-empty">No encontré «{q}». Prueba con el nombre y la ciudad.</p>}
          {err && <p className="ms-empty">{err}</p>}
          <button
            type="button"
            className={`ms-pin${pinning ? ' on' : ''}`}
            onClick={() => {
              onPin();
              setOpen(false);
              input.current?.blur();
            }}
          >
            <MapPinned size={16} /> {pinning ? 'Toca el mapa para elegir…' : 'Elegir un punto en el mapa'}
          </button>
        </div>
      )}
    </div>
  );
}
