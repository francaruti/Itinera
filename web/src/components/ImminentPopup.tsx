import { BedDouble, Plane, Ticket, Utensils, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { upcomingItems, type Upcoming } from '../lib/upcoming';
import { useStore } from '../store';

const SEEN_KEY = 'viaje:seen';
const ICON: Record<Upcoming['kind'], LucideIcon> = { flight: Plane, hotel: BedDouble, ticket: Ticket, activity: Utensils };

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function writeSeen(v: Record<string, string>) {
  try {
    // se descartan las claves viejas para que no crezca sin límite
    const keys = Object.keys(v).slice(-60);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, v[k]]))));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Al abrir la app: si una reserva importante está cerca (menos de 24 h; vuelve a avisar cuando faltan
 * menos de 3 h) sale un aviso con el acceso directo a su información. Cada aviso se muestra una sola vez.
 */
export function ImminentPopup() {
  const status = useStore((s) => s.status);
  const hasSnap = useStore((s) => !!s.snap);
  const [items, setItems] = useState<Upcoming[]>([]);

  useEffect(() => {
    if (status !== 'ready' || !hasSnap) return;
    const check = () => {
      const snap = useStore.getState().snap;
      if (!snap || document.visibilityState !== 'visible') return;
      const seen = readSeen();
      const fresh = upcomingItems(snap).filter((i) => i.urgency !== 'later' && seen[i.key] !== i.urgency && !(seen[i.key] === 'now'));
      if (fresh.length === 0) return;
      for (const i of fresh) seen[i.key] = i.urgency;
      writeSeen(seen);
      setItems(fresh.slice(0, 4));
    };
    const t = setTimeout(check, 1400);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, [status, hasSnap]);

  const close = useCallback(() => setItems([]), []);
  const open = (i: Upcoming) => {
    const st = useStore.getState();
    close();
    if (i.kind === 'activity') {
      const a = st.snap?.activities.find((x) => x.id === i.id);
      if (a) st.selectDate(a.dayDate);
      st.setTab('itinerario');
      st.openDetail(i.id);
    } else st.openDocs({ kind: i.kind, id: i.id });
  };

  // Escape cierra el aviso (captura: no depende de ninguna otra hoja)
  useEffect(() => {
    if (items.length === 0) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, close]);

  if (items.length === 0) return null;
  // Diálogo propio (no usa <Sheet>): el aviso nunca debe quedarse sin poder cerrarse.
  return createPortal(
    <div className="imm-scrim" onClick={close}>
      <div className="imm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="imm-title" onClick={(e) => e.stopPropagation()}>
        <div className="imm-head">
          <h2 id="imm-title" className="h-stretch">
            {items.length === 1 ? 'Se acerca algo importante' : 'Se acercan cosas importantes'}
          </h2>
          <button type="button" className="imm-x" onClick={close} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <ul className="imm-list">
          {items.map((i) => {
            const Icon = ICON[i.kind];
            return (
              <li key={i.key}>
                <button type="button" className={`imm-item ${i.urgency}`} onClick={() => open(i)}>
                  <span className={`qa-ico k-${i.kind}`}>
                    <Icon size={20} />
                  </span>
                  <span className="qa-text">
                    <strong className="clamp-2">{i.title}</strong>
                    <small>
                      {i.when}
                      {i.missingDoc ? ' · falta guardar el pase de abordar' : ''}
                    </small>
                  </span>
                  <span className="imm-go">Abrir</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn imm-later" onClick={close}>
          Ahora no
        </button>
      </div>
    </div>,
    document.body,
  );
}
