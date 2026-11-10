import { CalendarDays, MapPin, Navigation, X } from 'lucide-react';
import { DOW_ES, dayOfMonth, dowIndex, formatTime12 } from '../../../../shared/time';
import { CATEGORY_ICON } from '../../lib/meta';
import { photoForActivity } from '../../lib/photos';
import { formatDistance } from '../../lib/geo';
import { Photo } from '../photos/Photo';
import type { Stop } from './types';

interface Props {
  stop: Stop;
  /** Metros desde la persona, si se sabe */
  meters: number | null;
  onGo(): void;
  onPlan(): void;
  onClose(): void;
}

/** Ficha de la parada que se tocó en el mapa. */
export function PlaceCard({ stop, meters, onGo, onPlan, onClose }: Props) {
  const a = stop.a;
  const ph = photoForActivity(a);
  const Icon = CATEGORY_ICON[a.category];
  return (
    <section className="pc" aria-label="Parada seleccionada">
      <div className="pc-main">
        {ph ? (
          <Photo className="pc-photo" photo={ph} width={500} alt="" />
        ) : (
          <span className={`pc-photo pc-icon cat-${a.category}`} aria-hidden="true">
            <Icon size={26} />
          </span>
        )}
        <div className="pc-text">
          <small>
            <CalendarDays size={12} /> {DOW_ES[dowIndex(a.dayDate)].slice(0, 3)} {dayOfMonth(a.dayDate)}
            {a.time ? ` · ${formatTime12(a.time)}` : ''} · parada {stop.n}
          </small>
          <h3 className="clamp-2">{a.text}</h3>
          {a.place && (
            <span className="clamp-1 muted">
              <MapPin size={12} /> {a.place}
              {meters != null ? ` · a ${formatDistance(meters)}` : ''}
            </span>
          )}
        </div>
        <button type="button" className="rp-x" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      <div className="pc-actions">
        <button type="button" className="btn accent sm" onClick={onGo}>
          <Navigation size={15} /> Cómo llegar
        </button>
        <button type="button" className="btn sm" onClick={onPlan}>
          Ver en el plan
        </button>
      </div>
    </section>
  );
}
