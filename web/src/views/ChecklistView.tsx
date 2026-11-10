import { AnimatePresence, motion } from 'framer-motion';
import { Backpack, ChevronDown, ClipboardCheck, Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ChecklistItem, ChecklistList } from '../../../shared/types';
import { CheckCircle } from '../components/ui/CheckCircle';
import { Ring } from '../components/ui/Ring';
import { Seg } from '../components/ui/Seg';
import { Sheet } from '../components/ui/Sheet';
import { celebrate } from '../lib/confetti';
import { op } from '../lib/ops';
import { nextPosition } from '../lib/selectors';
import { uid } from '../lib/uid';
import { useStore } from '../store';

const COPY: Record<ChecklistList, { title: string; sub: string; done: string; placeholder: string }> = {
  pending: {
    title: 'Pendientes antes de viajar',
    sub: 'Documentos, reservas y cosas por resolver.',
    done: '¡Todo listo para despegar!',
    placeholder: 'Añadir pendiente…',
  },
  packing: {
    title: 'Maleta',
    sub: 'Lo que no puede faltar en el equipaje.',
    done: '¡Maleta lista!',
    placeholder: 'Añadir a la maleta…',
  },
};

function Item({ item }: { item: ChecklistItem }) {
  const dispatch = useStore((s) => s.dispatch);
  const removeWithUndo = useStore((s) => s.removeWithUndo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== item.text) dispatch(op.checklist.patch(item.id, { text: t }));
    else setDraft(item.text);
  }

  return (
    <motion.li
      layout
      className={`cl-item${item.done ? ' done' : ''}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
    >
      <CheckCircle checked={item.done} label={`Marcar: ${item.text}`} onChange={(done) => dispatch(op.checklist.patch(item.id, { done }))} />
      {editing ? (
        <input
          ref={input}
          className="input cl-edit"
          value={draft}
          maxLength={300}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(item.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button className="cl-text" onClick={() => setEditing(true)} title="Editar">
          {item.text}
        </button>
      )}
      <button
        className="icon-btn sm danger cl-del"
        aria-label={`Quitar: ${item.text}`}
        onClick={() => removeWithUndo('Elemento eliminado', op.checklist.del(item.id), op.checklist.put(item))}
      >
        <Trash2 size={15} />
      </button>
    </motion.li>
  );
}

export default function ChecklistView() {
  const snap = useStore((s) => s.snap)!;
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const [list, setList] = useState<ChecklistList>('pending');
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState('');

  const items = useMemo(() => snap.checklist.filter((c) => c.list === list).sort((a, b) => a.position - b.position), [snap.checklist, list]);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? done / items.length : 0;
  const categories = useMemo(() => [...new Set(items.map((i) => i.category || 'General'))], [items]);

  // Celebrar al completar la lista (no al abrirla ya completa).
  const prev = useRef({ list, complete: items.length > 0 && done === items.length });
  useEffect(() => {
    const complete = items.length > 0 && done === items.length;
    if (prev.current.list === list && complete && !prev.current.complete) {
      celebrate();
      toast(COPY[list].done + ' 🎉', 'success');
    }
    prev.current = { list, complete };
  }, [done, items.length, list, toast]);

  function add(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    dispatch(op.checklist.put({ id: uid(), list, text: t, done: false, category: category.trim(), position: nextPosition(items) }));
    setText('');
    toast('Añadido', 'success');
  }

  const toggleGroup = (c: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (!n.delete(c)) n.add(c);
      return n;
    });

  return (
    <div className="container narrow">
      <header className="view-head">
        <div>
          <h1 className="display view-title">{list === 'pending' ? 'Pendientes' : 'Maleta'}</h1>
          <p className="muted">{COPY[list].sub}</p>
        </div>
        <Seg
          value={list}
          onChange={(v) => setList(v)}
          label="Lista"
          options={[
            { value: 'pending', label: (<><ClipboardCheck size={15} /> Antes de viajar</>) },
            { value: 'packing', label: (<><Backpack size={15} /> Maleta</>) },
          ]}
        />
      </header>

      <section className="card cl-summary">
        <Ring value={pct} size={92} stroke={9} label={`${Math.round(pct * 100)}%`} />
        <div className="grow">
          <h2 className="h-stretch" style={{ fontSize: 22 }}>
            {items.length === 0 ? 'Lista vacía' : done === items.length ? COPY[list].done : `${done} de ${items.length} listos`}
          </h2>
          <p className="muted small">{items.length - done > 0 ? `Faltan ${items.length - done}.` : 'No queda nada pendiente.'}</p>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => setHideDone((h) => !h)}>
              {hideDone ? <Eye size={15} /> : <EyeOff size={15} />} {hideDone ? 'Mostrar listos' : 'Ocultar listos'}
            </button>
            {done > 0 && (
              <button
                className="btn ghost sm"
                onClick={() => {
                  const ids = items.filter((i) => i.done);
                  dispatch(ids.map((i) => op.checklist.patch(i.id, { done: false })));
                  toast(`Lista reiniciada (${ids.length})`, 'info', { label: 'Deshacer', run: () => dispatch(ids.map((i) => op.checklist.patch(i.id, { done: true }))) });
                }}
              >
                <RotateCcw size={15} /> Reiniciar
              </button>
            )}
          </div>
        </div>
      </section>

      <button type="button" className="cl-fab" onClick={() => setAdding(true)} aria-label={COPY[list].placeholder.replace('…', '')}>
        <Plus size={24} />
        <span>Añadir</span>
      </button>

      <Sheet open={adding} onClose={() => setAdding(false)} title={list === 'pending' ? 'Nuevo pendiente' : 'Añadir a la maleta'}>
        <form className="sheet-body" onSubmit={add}>
          <label className="field">
            <span>¿Qué es?</span>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={COPY[list].placeholder} maxLength={300} data-autofocus />
          </label>
          <div className="field">
            <span>Categoría</span>
            <div className="row wrap">
              {categories.map((c) => (
                <button key={c} type="button" className="chip pick" aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>
                  {c}
                </button>
              ))}
            </div>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="O escribe una nueva…" maxLength={60} aria-label="Categoría" />
          </div>
          <div className="sheet-foot" style={{ marginTop: 4 }}>
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
              Cerrar
            </button>
            <button className="btn accent" type="submit" disabled={!text.trim()}>
              <Plus size={17} /> Añadir
            </button>
          </div>
        </form>
      </Sheet>

      {items.length === 0 && (
        <div className="empty-state card">
          <ClipboardCheck />
          <strong>Nada por aquí todavía</strong>
          <span>Toca «Añadir» para crear el primero.</span>
        </div>
      )}

      {categories.map((cat) => {
        const group = items.filter((i) => (i.category || 'General') === cat);
        const visible = hideDone ? group.filter((i) => !i.done) : group;
        const gDone = group.filter((i) => i.done).length;
        const open = !collapsed.has(cat);
        if (hideDone && visible.length === 0) return null;
        return (
          <section key={cat} className="card cl-group">
            <button className="cl-group-head" onClick={() => toggleGroup(cat)} aria-expanded={open}>
              <h2 className="h-stretch">{cat}</h2>
              <span className="chip">
                {gDone}/{group.length}
              </span>
              <motion.span animate={{ rotate: open ? 0 : -90 }} className="chev">
                <ChevronDown size={18} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul
                  className="cl-list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AnimatePresence initial={false}>
                    {visible.map((i) => (
                      <Item key={i.id} item={i} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
