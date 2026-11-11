import { BedDouble, CalendarDays, CloudSun, Languages, ListChecks, Map as MapIcon, MapPinPlus, Plane, Search, Ticket, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cityMeta } from '../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex, formatTime12, nowInZone } from '../../../shared/time';
import { CATEGORY_ICON } from '../lib/meta';
import { photoForActivity, type PhotoInfo } from '../lib/photos';
import { Photo } from './photos/Photo';
import { useStore, type TabId } from '../store';
import { Sheet } from './ui/Sheet';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Result {
  key: string;
  group: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  photo?: PhotoInfo | null;
  go(): void;
}

export default function SearchPalette() {
  const snap = useStore((s) => s.snap)!;
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const selectDate = useStore((s) => s.selectDate);
  const setTab = useStore((s) => s.setTab);
  const flash = useStore((s) => s.flash);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const close = () => setOpen(false);
  const goTab = (tab: TabId) => {
    setTab(tab);
    close();
  };

  const results = useMemo<Result[]>(() => {
    const query = norm(q.trim());
    const out: Result[] = [];
    if (!query) {
      const today = nowInZone(snap.trip.timezone).date;
      const quick: Array<[string, LucideIcon, string, () => void]> = [
        ['Mis vuelos', Plane, 'Pases de abordar, número de vuelo y reserva', () => (close(), useStore.getState().openDocs({ kind: 'flight' }))],
        ['Mis hoteles', BedDouble, 'Capturas de Booking y números de reserva', () => (close(), useStore.getState().openDocs({ kind: 'hotel' }))],
        ['Mis entradas', Ticket, 'Parques, miradores y shows', () => (close(), useStore.getState().openDocs({ kind: 'ticket' }))],
        ['Abrir el mapa', MapIcon, 'Buscar un destino y ver cuánto tardas', () => goTab('mapa')],
        ['Clima de los días', CloudSun, 'Pronóstico por hora', () => goTab('clima')],
        ['Frases útiles en inglés', Languages, 'Escúchalas y cópialas', () => goTab('info')],
      ];
      if (snap.days.some((d) => d.date === today)) {
        quick.unshift(['Ir a hoy', CalendarDays, 'Tu plan de hoy', () => (selectDate(today), goTab('itinerario'))]);
      }
      for (const [title, icon, sub, go] of quick) out.push({ key: `q-${title}`, group: 'Atajos', icon, title, sub, go });
      for (const d of snap.days) {
        out.push({
          key: `d-${d.date}`,
          group: 'Ir a un día',
          icon: CalendarDays,
          title: `${DOW_ES[dowIndex(d.date)]} ${dayOfMonth(d.date)}`,
          sub: `${cityMeta(d.city).name} · ${d.title}`,
          go() {
            selectDate(d.date);
            goTab('itinerario');
          },
        });
      }
      return out;
    }
    const has = (...parts: string[]) => parts.some((p) => norm(p).includes(query));
    if (q.trim().length >= 3) {
      out.push({
        key: 'add-place',
        group: 'Añadir al itinerario',
        icon: MapPinPlus,
        title: `Buscar «${q.trim()}» en el mapa y añadirlo`,
        sub: 'Encuentra el lugar y agrégalo a un día',
        go() {
          close();
          useStore.getState().openAddPlace({ query: q.trim() });
        },
      });
    }
    for (const a of snap.activities) {
      if (!has(a.text, a.place, a.notes)) continue;
      const d = snap.days.find((x) => x.date === a.dayDate);
      out.push({
        key: `a-${a.id}`,
        group: 'Actividades',
        icon: CATEGORY_ICON[a.category],
        photo: photoForActivity(a),
        title: a.text,
        sub: `${DOW_ES[dowIndex(a.dayDate)]} ${dayOfMonth(a.dayDate)}${a.time ? ` · ${formatTime12(a.time)}` : ''}${d ? ` · ${cityMeta(d.city).name}` : ''}`,
        go() {
          selectDate(a.dayDate);
          setTab('itinerario');
          close();
          setTimeout(() => flash(a.id), 300);
        },
      });
    }
    for (const r of snap.reservations) {
      if (has(r.title, r.provider, r.flightNo, r.confirmation, r.address, r.notes)) out.push({ key: `r-${r.id}`, group: 'Reservas', icon: Ticket, title: r.title, sub: [r.provider, r.flightNo, r.confirmation].filter(Boolean).join(' · ') || 'Reserva', go: () => (close(), useStore.getState().openDocs({ kind: r.kind === 'flight' ? 'flight' : r.kind === 'hotel' ? 'hotel' : 'ticket', id: r.id })) });
    }
    for (const c of snap.checklist) {
      if (has(c.text, c.category)) out.push({ key: `c-${c.id}`, group: c.list === 'pending' ? 'Pendientes' : 'Maleta', icon: ListChecks, title: c.text, sub: c.done ? 'Listo' : 'Por hacer', go: () => goTab('pendientes') });
    }
    for (const e of snap.expenses) {
      if (has(e.description, e.paidBy)) out.push({ key: `e-${e.id}`, group: 'Gastos', icon: Wallet, title: e.description, sub: `${e.amount} ${e.currency}`, go: () => goTab('presupuesto') });
    }
    return out.slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, snap]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[active]?.go();
    }
  }

  let lastGroup = '';
  return (
    <Sheet open={open} onClose={close} hideHeader top wide>
      <div className="palette" onKeyDown={onKey}>
        <div className="palette-input">
          <Search size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el viaje…" aria-label="Buscar" data-autofocus />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" ref={list} role="listbox">
          {results.length === 0 && <li className="palette-empty">Sin resultados para “{q}”.</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            const Icon = r.icon;
            return (
              <li key={r.key} role="presentation">
                {header && <div className="palette-group">{header}</div>}
                <button role="option" aria-selected={i === active} data-active={i === active} className="palette-item" onMouseMove={() => setActive(i)} onClick={r.go}>
                  <Icon size={18} />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.sub}</small>
                  </span>
                  {r.photo && <Photo className="palette-thumb" photo={r.photo} width={500} alt="" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
