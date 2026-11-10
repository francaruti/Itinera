import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CITY_META } from '../../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex, formatTime12 } from '../../../../shared/time';
import type { City, Snapshot } from '../../../../shared/types';
import { cityClass } from '../../lib/meta';
import { photoForActivity, type PhotoInfo } from '../../lib/photos';
import { dayActivities } from '../../lib/selectors';
import { useStore } from '../../store';
import { Seg } from '../ui/Seg';
import { Photo } from './Photo';

interface Place {
  photo: PhotoInfo;
  date: string;
  actId: string;
  time: string;
  count: number;
}

/** Carrusel con todos los lugares del itinerario que tienen foto; tocar uno lleva a su día. */
export function PlacesGallery({ snap }: { snap: Snapshot }) {
  const selectDate = useStore((s) => s.selectDate);
  const flash = useStore((s) => s.flash);
  const [city, setCity] = useState<City | 'all'>('all');
  const scroller = useRef<HTMLDivElement>(null);

  const places = useMemo(() => {
    const seen = new Map<string, Place>();
    for (const d of snap.days) {
      for (const a of dayActivities(snap, d.date)) {
        const p = photoForActivity(a);
        if (!p) continue;
        const prev = seen.get(p.key);
        if (prev) prev.count++;
        else seen.set(p.key, { photo: p, date: d.date, actId: a.id, time: a.time, count: 1 });
      }
    }
    return [...seen.values()];
  }, [snap]);

  const cities = useMemo(() => [...new Set(snap.days.map((d) => d.city))], [snap.days]);
  const shown = places.filter((p) => city === 'all' || p.photo.city === city);
  if (places.length === 0) return null;

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <section className="gallery" aria-label="Lugares del viaje">
      <div className="gallery-head">
        <h2 className="h-stretch">
          <Images size={20} /> Lugares que vas a conocer <span className="chip">{shown.length}</span>
        </h2>
        <div className="row">
          <Seg
            value={city}
            onChange={(v) => setCity(v)}
            label="Filtrar por ciudad"
            options={[
              { value: 'all', label: 'Todos' },
              ...cities.map((c) => ({ value: c, label: CITY_META[c].name })),
            ]}
          />
          <div className="gallery-arrows">
            <button className="icon-btn sm" onClick={() => scrollBy(-1)} aria-label="Anterior">
              <ChevronLeft size={18} />
            </button>
            <button className="icon-btn sm" onClick={() => scrollBy(1)} aria-label="Siguiente">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="gallery-track" ref={scroller}>
        {shown.map((pl, i) => (
          <motion.button
            key={pl.photo.key}
            className="place-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 80px 0px 0px' }}
            transition={{ delay: Math.min(i, 6) * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              selectDate(pl.date);
              window.scrollTo({ top: document.querySelector('.panel')?.getBoundingClientRect().top! + window.scrollY - 90, behavior: 'smooth' });
              setTimeout(() => flash(pl.actId), 450);
            }}
            aria-label={`${pl.photo.name}: ver en el itinerario`}
          >
            <Photo photo={pl.photo} width={500} alt={pl.photo.name} />
            <span className="place-shade" aria-hidden="true" />
            <span className={`place-city ${cityClass(pl.photo.city)}`}>{CITY_META[pl.photo.city].short}</span>
            <span className="place-info">
              <strong>{pl.photo.name}</strong>
              <small>
                {DOW_ES[dowIndex(pl.date)].slice(0, 3)} {dayOfMonth(pl.date)}
                {pl.time ? ` · ${formatTime12(pl.time)}` : ''}
              </small>
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
