import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { ArrowUpDown, CalendarCog, Share2, CalendarOff, CalendarPlus, ChevronDown, CheckCheck, ChevronLeft, ChevronRight, MoreHorizontal, Plane, RotateCcw, Trash2 } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CITY_META } from '../../../../shared/constants';
import { addDays, formatTime12, longDate, timeToMinutes } from '../../../../shared/time';
import type { Activity, Snapshot } from '../../../../shared/types';
import { celebrate } from '../../lib/confetti';
import { success, tap } from '../../lib/haptics';
import { copyText, money } from '../../lib/format';
import { cityClass } from '../../lib/meta';
import { CATALOG } from '../../lib/catalog';
import { CATALOG_INDEX } from '../../lib/placeinfo';
import { alternativesFor } from '../../lib/schedule';
import { op } from '../../lib/ops';
import { dayActivities, nowAndNext, positionBetween, tripPhase } from '../../lib/selectors';
import { useStore } from '../../store';
import { AutoTextarea } from '../ui/AutoTextarea';
import { Confirm } from '../ui/Confirm';
import { Menu } from '../ui/Menu';
import { coverFor } from '../../lib/photos';
import { DayCover } from '../photos/DayCover';
import { ActivityEditor } from './ActivityEditor';
import { ActivityRow } from './ActivityRow';
import { NextUp } from './NextUp';
import { QuickAdd } from './QuickAdd';
// Las hojas de detalle y alternativas se descargan solo cuando se abren por primera vez.
const AlternativesSheet = lazy(() => import('./AlternativesSheet'));
const PlaceSheet = lazy(() => import('./PlaceSheet'));
import { WeatherChip } from './WeatherChip';

export function DayView({ snap }: { snap: Snapshot }) {
  const date = useStore((s) => s.selectedDate);
  const selectDate = useStore((s) => s.selectDate);
  const dispatch = useStore((s) => s.dispatch);
  const highlightId = useStore((s) => s.highlightId);
  const removeWithUndo = useStore((s) => s.removeWithUndo);
  const toast = useStore((s) => s.toast);
  const openDaySheet = useStore((s) => s.openDaySheet);
  const openDetail = useStore((s) => s.openDetail);
  const openAlts = useStore((s) => s.openAlts);
  const detailId = useStore((s) => s.detailId);
  const altsId = useStore((s) => s.altsId);
  const seenSheets = useRef({ detail: false, alts: false });
  if (detailId) seenSheets.current.detail = true;
  if (altsId) seenSheets.current.alts = true;

  const index = snap.days.findIndex((d) => d.date === date);
  const day = snap.days[index];
  const acts = useMemo(() => dayActivities(snap, date), [snap, date]);

  const cover = useMemo(() => {
    const d = snap.days.find((x) => x.date === date);
    return d ? coverFor(d, acts) : null;
  }, [snap.days, date, acts]);


  const [items, setItems] = useState<Activity[]>(acts);
  /** Alternativas reales por actividad: el botón ⇄ solo aparece si hay alguna. */
  const altCounts = useMemo(
    () => new Map(items.map((a) => [a.id, a.category === 'transport' || a.category === 'lodging' || a.category === 'rest' ? 0 : alternativesFor(a, snap, CATALOG, CATALOG_INDEX).length])),
    [items, snap],
  );
  const dragging = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (!dragging.current) setItems(acts);
  }, [acts]);

  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dir, setDir] = useState(1);
  const lastIndex = useRef(index);
  useEffect(() => {
    setDir(index >= lastIndex.current ? 1 : -1);
    lastIndex.current = index;
  }, [index]);

  const { today, time, phase } = tripPhase(snap);
  const live = phase === 'during' && today === date ? nowAndNext(acts, time) : { current: null, next: null };

  // Callbacks estables: las filas no se vuelven a dibujar cuando cambia otra cosa del día.
  const handlers = useRef({ toggle, commitOrder, moveBy });
  handlers.current = { toggle, commitOrder, moveBy };
  const onToggle = useCallback((a: Activity, e: MouseEvent<HTMLButtonElement>) => handlers.current.toggle(a, e), []);
  const onCommit = useCallback((a: Activity) => handlers.current.commitOrder(a), []);
  const onMove = useCallback((a: Activity, d: -1 | 1) => handlers.current.moveBy(a, d), []);
  const onOpen = useCallback((x: Activity) => openDetail(x.id), [openDetail]);
  const onEdit = useCallback((x: Activity) => setEditId(x.id), []);
  const onAlts = useCallback((x: Activity) => openAlts(x.id), [openAlts]);
  const onDragStart = useCallback(() => {
    dragging.current = true;
  }, []);

  if (!day) return null;
  const done = acts.filter((a) => a.done).length;
  const pct = acts.length ? done / acts.length : 0;
  const cost = acts.reduce((n, a) => n + (a.cost ?? 0), 0);
  const prev = snap.days[index - 1];
  const next = snap.days[index + 1];

  function toggle(a: Activity, e: MouseEvent<HTMLButtonElement>) {
    tap();
    dispatch(op.activity.patch(a.id, { done: !a.done }));
    const finishing = !a.done && acts.every((x) => (x.id === a.id ? true : x.done));
    if (finishing && acts.length > 1) {
      const r = e.currentTarget.getBoundingClientRect();
      success();
      celebrate({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
      toast('¡Día completado! 🎉', 'success');
    }
  }

  const swipe = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const blocked = (e.target as HTMLElement).closest('input, textarea, select, .grip, .menu, .photo-credit');
    swipe.current = blocked ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
      const target = dx < 0 ? next : prev;
      if (target) {
        tap(6);
        selectDate(target.date);
      }
    }
  }

  function moveBy(a: Activity, dir: -1 | 1) {
    const i = acts.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= acts.length) return;
    const rest = acts.filter((x) => x.id !== a.id);
    dispatch(op.activity.patch(a.id, { position: positionBetween(rest[j - 1], rest[j]) }));
    toast(`Movida a la posición ${j + 1} de ${acts.length}`);
  }

  function commitOrder(a: Activity) {
    dragging.current = false;
    const list = itemsRef.current;
    const i = list.findIndex((x) => x.id === a.id);
    if (i < 0) return;
    const pos = positionBetween(list[i - 1], list[i + 1]);
    if (pos !== a.position) dispatch(op.activity.patch(a.id, { position: pos }));
  }

  function sortByTime() {
    const sorted = [...acts].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.position - b.position);
    dispatch(sorted.map((a, i) => op.activity.patch(a.id, { position: (i + 1) * 10 })));
    toast('Ordenado por hora', 'success');
  }

  async function shareDay() {
    const lines = acts.map((a) => `${a.time ? `${formatTime12(a.time)} · ` : '• '}${a.text}${a.place && !a.text.includes(a.place) ? ` (${a.place})` : ''}${a.url && a.booking !== 'none' ? `\n   ${a.url}` : ''}`);
    const text = `${longDate(date)}${day.title ? ` — ${day.title}` : ''}\n${CITY_META[day.city].name}\n\n${lines.join('\n')}`;
    try {
      if (navigator.share) await navigator.share({ title: `Plan del ${longDate(date)}`, text });
      else if (await copyText(text)) toast('Plan copiado: pégalo donde quieras', 'success');
    } catch {
      /* se canceló */
    }
  }

  function markAll(value: boolean) {
    dispatch(acts.filter((a) => a.done !== value).map((a) => op.activity.patch(a.id, { done: value })));
    if (value && acts.length > 1) celebrate();
  }

  function addDay() {
    const last = snap.days[snap.days.length - 1];
    const date = addDays(last.date, 1);
    dispatch(op.day.put({ date, city: last.city, travel: false, title: '', notes: '' }));
    selectDate(date);
    toast('Día añadido al final del viaje', 'success');
  }

  function deleteDay() {
    setConfirmDelete(false);
    const restore = [op.day.put(day), ...acts.map((a) => op.activity.put(a))];
    removeWithUndo('Día eliminado', op.day.del(day.date), restore);
  }

  return (
    <section className="panel card" aria-label="Plan del día" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {cover && <DayCover key={`${date}-${cover.key}`} photo={cover} />}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={date}
          custom={dir}
          initial={{ opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -28 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="day-head">
            <div className="day-head-main">
              <h2 className="day-date h-stretch">{longDate(date)}</h2>
              <div className="row wrap">
                <button className={`chip ${cityClass(day.city)} chip-btn`} onClick={() => openDaySheet({ mode: 'edit', date: day.date })} title="Cambiar la ciudad de este día">
                  {CITY_META[day.city].name}
                </button>
                {day.travel && (
                  <span className="chip">
                    <Plane size={12} /> Día de viaje
                  </span>
                )}
                {date === today && phase === 'during' && <span className="chip now">Hoy</span>}
              </div>
            </div>
            <div className="day-head-side">
              <WeatherChip city={day.city} date={date} />
              <Menu
                label="Opciones del día"
                trigger={<MoreHorizontal size={20} />}
                items={[
                  { label: 'Compartir el día', icon: <Share2 size={16} />, onSelect: () => void shareDay(), disabled: !acts.length },
                  { label: 'Ordenar por hora', icon: <ArrowUpDown size={16} />, onSelect: sortByTime, disabled: acts.length < 2 },
                  { label: 'Marcar todo como hecho', icon: <CheckCheck size={16} />, onSelect: () => markAll(true), disabled: !acts.length },
                  { label: 'Desmarcar todo', icon: <RotateCcw size={16} />, onSelect: () => markAll(false), disabled: !done },
                  { label: 'Editar día (ciudad y tipo)', icon: <CalendarCog size={16} />, onSelect: () => openDaySheet({ mode: 'edit', date: day.date }) },
                  { label: 'Añadir día en otra fecha…', icon: <CalendarPlus size={16} />, onSelect: () => openDaySheet({ mode: 'add' }) },
                  { label: 'Añadir día al final', icon: <CalendarPlus size={16} />, onSelect: addDay },
                  { label: 'Eliminar día', icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true), disabled: snap.days.length < 2 },
                ]}
              />
            </div>
          </div>

          <AutoTextarea
            className="title-in"
            aria-label="Nombre del día"
            value={day.title}
            maxLength={200}
            placeholder="¿Qué haremos este día?"
            onChange={(e) => dispatch(op.day.patch(day.date, { title: e.target.value }))}
          />

          <NextUp acts={acts} date={date} />

          {acts.length > 0 && (
            <div className="day-progress">
              <div className="bar-track" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del día">
                <motion.div className="bar-fill" initial={false} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <small className="muted tnum">
                {done} de {acts.length} hechas{cost > 0 && ` · ${money(cost)} estimados`}
              </small>
            </div>
          )}

          {acts.length === 0 ? (
            <div className="empty-state">
              <CalendarOff />
              <strong>Día libre por ahora</strong>
              <span>Añade el primer plan abajo.</span>
            </div>
          ) : (
            <Reorder.Group axis="y" values={items} onReorder={setItems} className="acts" as="ol">
              <AnimatePresence initial={false}>
                {items.map((a) => (
                  <ActivityRow
                    key={a.id}
                    a={a}
                    isCurrent={live.current === a.id}
                    isNext={live.next === a.id}
                    highlighted={highlightId === a.id}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    altCount={altCounts.get(a.id) ?? 0}
                    onAlts={onAlts}
                    onDragStart={onDragStart}
                    onDragEnd={onCommit}
                    onMove={onMove}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}

          <QuickAdd date={date} acts={acts} />

          <details className="day-notes">
            <summary>
              <span className="notes-label">Notas del día</span>
              {day.notes && <span className="notes-preview clamp-1">{day.notes}</span>}
              <ChevronDown size={16} className="chev" />
            </summary>
            <textarea
              id="day-notes"
              className="textarea"
              value={day.notes}
              maxLength={5000}
              placeholder="Direcciones, reservas, presupuesto…"
              aria-label="Notas del día"
              onChange={(e) => dispatch(op.day.patch(day.date, { notes: e.target.value }))}
            />
          </details>

          <div className="day-nav">
            <button className="nav-btn" disabled={!prev} onClick={() => prev && selectDate(prev.date)}>
              <ChevronLeft size={18} />
              <span>
                <small>Anterior</small>
                {prev ? longDate(prev.date).split(' ').slice(0, 2).join(' ') : '—'}
              </span>
            </button>
            <button className="nav-btn right" disabled={!next} onClick={() => next && selectDate(next.date)}>
              <span>
                <small>Siguiente</small>
                {next ? longDate(next.date).split(' ').slice(0, 2).join(' ') : '—'}
              </span>
              <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <ActivityEditor id={editId} onClose={() => setEditId(null)} />
      <Suspense fallback={null}>
        {(detailId || seenSheets.current.detail) && <PlaceSheet onEdit={(id) => setEditId(id)} />}
        {(altsId || seenSheets.current.alts) && <AlternativesSheet />}
      </Suspense>
      <Confirm
        open={confirmDelete}
        title="¿Eliminar este día?"
        message="Se borrarán el día y todas sus actividades. Podrás deshacerlo unos segundos."
        confirmLabel="Eliminar día"
        onConfirm={deleteDay}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
