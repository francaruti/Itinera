import { Reorder, motion, useDragControls } from 'framer-motion';
import { Check, GripVertical, MapPin, Pencil, Replace, Ticket } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { ACTIVITY_CATEGORY_LABEL } from '../../../../shared/constants';
import { formatTime12 } from '../../../../shared/time';
import type { Activity } from '../../../../shared/types';
import { mapsSearchUrl } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/meta';
import { photoForActivity } from '../../lib/photos';
import { bookingUrl, placeInfoFor, wantsBooking } from '../../lib/placeinfo';
import { Photo } from '../photos/Photo';

interface Props {
  a: Activity;
  isCurrent: boolean;
  isNext: boolean;
  highlighted: boolean;
  onToggle(a: Activity, e: MouseEvent<HTMLButtonElement>): void;
  onOpen(a: Activity): void;
  onDragStart(): void;
  onDragEnd(a: Activity): void;
  onMove(a: Activity, dir: -1 | 1): void;
  /** Abre el editor completo (lápiz). */
  onEdit(a: Activity): void;
  /** Cantidad de alternativas disponibles; con 0 no se muestra el botón. */
  altCount: number;
  onAlts(a: Activity): void;
}

export const ActivityRow = memo(ActivityRowImpl);

function ActivityRowImpl({ a, isCurrent, isNext, highlighted, onToggle, onOpen, onDragStart, onDragEnd, onMove, onEdit, altCount, onAlts }: Props) {
  const controls = useDragControls();
  const ref = useRef<HTMLLIElement>(null);
  const Icon = CATEGORY_ICON[a.category];
  const thumb = useMemo(() => photoForActivity(a), [a.place, a.text]);
  const info = useMemo(() => placeInfoFor(a), [a]);
  const book = wantsBooking(info.place, a);
  const url = bookingUrl(info.place, a);
  const closed = info.open?.state === 'closed';
  // Si el lugar es lo mismo que el título (p. ej. una atracción), no se repite.
  const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const showPlace = !!a.place && !(key(a.text).includes(key(a.place)) || key(a.place).includes(key(a.text)));

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  return (
    <Reorder.Item
      ref={ref}
      value={a}
      id={a.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={() => onDragEnd(a)}
      className={`act${a.done ? ' done' : ''}${isCurrent ? ' current' : ''}${highlighted ? ' flash' : ''}`}
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, height: 0 }}
      whileDrag={{ scale: 1.02, boxShadow: '0 18px 40px -12px rgba(14,27,44,.35)', zIndex: 5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
    >
      <div className="act-rail">
        <button
          className="check"
          role="checkbox"
          aria-checked={a.done}
          aria-label={`${a.done ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${a.text}`}
          onClick={(e) => onToggle(a, e)}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <motion.circle cx="12" cy="12" r="10" className="check-ring" animate={{ fill: a.done ? 'var(--ok)' : 'rgba(0,0,0,0)' }} transition={{ duration: 0.2 }} />
            <motion.path
              d="M7 12.5l3.2 3.2L17 9"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: a.done ? 1 : 0, opacity: a.done ? 1 : 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            />
          </svg>
        </button>
      </div>

      <div className="act-body" onClick={() => onOpen(a)} role="button" tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(a);
          }
        }} aria-label={`Ver detalle: ${a.text}`}>
        <div className="act-top">
          <span className={`act-time tnum${a.time ? '' : ' none'}`}>{a.time ? formatTime12(a.time) : 'Sin hora'}</span>
          {isCurrent && <span className="chip now">Ahora</span>}
          {isNext && <span className="chip next">Siguiente</span>}
          <span className={`cat-badge cat-${a.category}`} title={ACTIVITY_CATEGORY_LABEL[a.category]}>
            <Icon size={13} />
          </span>
        </div>
        <p className="act-text">{a.text}</p>
        {(showPlace || book || closed) && (
          <div className="act-meta">
            {showPlace && (
              <a href={mapsSearchUrl(a.place, a.lat, a.lng)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="meta-link">
                <MapPin size={13} /> <span className="clamp-1">{a.place}</span>
              </a>
            )}
            {closed && <span className="chip todo">{info.open!.label}</span>}
            {book && a.booking === 'booked' && (
              <span className="chip ok">
                <Check size={12} /> Reservado
              </span>
            )}
            {book && a.booking !== 'booked' &&
              (url ? (
                <a className="chip cta" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Ticket size={12} /> Reservar
                </a>
              ) : (
                <span className="chip todo">Por reservar</span>
              ))}
          </div>
        )}
      </div>

      {thumb && <Photo className="act-thumb" photo={thumb} width={500} zoom alt={thumb.name} />}

      <div className="act-actions">
        {altCount > 0 && (
          <button className="icon-btn sm alt-btn" aria-label={`Ver ${altCount} ${altCount === 1 ? 'alternativa' : 'alternativas'}`} title="Ver alternativas" onClick={() => onAlts(a)}>
            <Replace size={17} />
          </button>
        )}
        <button className="icon-btn sm edit-btn" aria-label="Editar actividad" onClick={() => onEdit(a)}>
          <Pencil size={15} />
        </button>
        <button
          className="icon-btn sm grip"
          aria-label="Reordenar: arrastra, o usa Alt + flechas arriba o abajo"
          title="Arrastra para reordenar (Alt + ↑ / ↓ con teclado)"
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              onMove(a, e.key === 'ArrowUp' ? -1 : 1);
            }
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
        >
          <GripVertical size={17} />
        </button>
      </div>
    </Reorder.Item>
  );
}
