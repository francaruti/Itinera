import { motion } from 'framer-motion';
import { Check, Clock, Footprints, Replace, Star, Ticket, Timer, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { formatTime12 } from '../../../../shared/time';
import type { Activity } from '../../../../shared/types';
import { CATALOG } from '../../lib/catalog';
import { money } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/meta';
import { op } from '../../lib/ops';
import { photo, photoForActivity } from '../../lib/photos';
import { CATALOG_INDEX } from '../../lib/placeinfo';
import { alternativesFor, retime, textFor, type Alternative } from '../../lib/schedule';
import { dayActivities } from '../../lib/selectors';
import { useStore } from '../../store';
import { Photo } from '../photos/Photo';
import { Sheet } from '../ui/Sheet';

const FIELDS = ['text', 'place', 'lat', 'lng', 'category', 'cost', 'url', 'booking', 'notes'] as const;

/** Tres alternativas cercanas, abiertas y bien calificadas. Elegir una cambia el plan y reacomoda los horarios (con deshacer). */
export default function AlternativesSheet() {
  const snap = useStore((s) => s.snap)!;
  const id = useStore((s) => s.altsId);
  const close = useStore((s) => s.openAlts);
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const flash = useStore((s) => s.flash);
  const a = snap.activities.find((x) => x.id === id) ?? null;

  const alts = useMemo(() => (a ? alternativesFor(a, snap, CATALOG, CATALOG_INDEX) : []), [a, snap]);

  function choose(act: Activity, alt: Alternative) {
    const p = alt.place;
    const next: Partial<Activity> = {
      // Si era una comida, se conserva el momento ("Almuerzo en …") aunque el lugar sirva a cualquier hora.
      text: p.category === 'food' && /^(Desayuno|Brunch|Almuerzo|Cena|Comida)\b/i.test(act.text) ? `${/^(\w+)/.exec(act.text)![1]} en ${p.name}` : textFor(p),
      place: p.name,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      cost: p.priceUsd ?? null,
      url: p.reserve?.url || p.url || '',
      booking: p.reserve && p.reserve.needed !== false && !/sin reserva/i.test(p.reserve.platform) ? 'todo' : 'none',
      notes: p.why,
      done: false,
    };
    const prev: Partial<Activity> = Object.fromEntries(FIELDS.map((f) => [f, act[f]])) as Partial<Activity>;
    prev.done = act.done;

    // Reacomodo de horarios con el lugar nuevo ya aplicado (otra duración puede traslapar lo siguiente).
    const after = dayActivities(snap, act.dayDate).map((x) => (x.id === act.id ? { ...x, ...next } : x));
    const shifts = retime(after, act.id, CATALOG_INDEX);

    dispatch([op.activity.patch(act.id, next), ...shifts.map((s) => op.activity.patch(s.id, { time: s.to }))]);
    close(null);
    toast(shifts.length ? `Cambiado a ${p.name} · ajusté ${shifts.length} ${shifts.length === 1 ? 'horario' : 'horarios'}` : `Cambiado a ${p.name}`, 'success', {
      label: 'Deshacer',
      run: () => dispatch([op.activity.patch(act.id, prev), ...shifts.map((s) => op.activity.patch(s.id, { time: s.from }))]),
    });
    setTimeout(() => flash(act.id), 350);
  }

  return (
    <Sheet open={!!a} onClose={() => close(null)} title="Alternativas" wide>
      {a && (
        <>
          <p className="muted alt-intro clamp-2">
            En lugar de <strong>{a.text}</strong>
            {a.time ? ` (${formatTime12(a.time)})` : ''}. Todas están abiertas a esa hora y cerca de tu plan anterior.
          </p>
          {alts.length === 0 ? (
            <div className="empty-state">
              <Replace />
              <strong>No encontré alternativas cercanas</strong>
              <span>Puedes buscar un lugar nuevo y añadirlo desde el itinerario.</span>
            </div>
          ) : (
            <ul className="alt-list">
              {alts.map((alt, i) => {
                const p = alt.place;
                // A los restaurantes no se les asigna foto de monumento por coincidencia de palabras.
                const img = (p.photo ? photo(p.photo) : null) ?? (p.category === 'food' ? null : photoForActivity({ place: p.name, text: p.name }));
                const Icon = CATEGORY_ICON[p.category];
                return (
                  <motion.li key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="alt-card">
                    <div className="alt-media">
                      {img ? (
                        <Photo photo={img} width={500} alt={p.name} />
                      ) : (
                        <span className={`alt-ico cat-${p.category}`}>
                          <Icon size={28} />
                        </span>
                      )}
                    </div>
                    <div className="alt-body">
                      <div className="alt-top">
                        <strong>{p.name}</strong>
                        {p.rating != null && (
                          <span className="alt-rate">
                            <Star size={13} /> {p.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="alt-why">{p.why}</p>
                      <div className="alt-chips">
                        <span className="chip">
                          <Footprints size={12} /> {alt.travel}
                        </span>
                        <span className={`chip ${alt.open.state === 'open' ? 'ok' : ''}`}>
                          <Clock size={12} /> {alt.open.label}
                        </span>
                        {p.waitMinutes && (
                          <span className="chip">
                            <Timer size={12} /> ~{p.waitMinutes.typical} min
                          </span>
                        )}
                        {p.priceUsd != null && (
                          <span className="chip">
                            <Wallet size={12} /> {money(p.priceUsd)}
                          </span>
                        )}
                      </div>
                      <div className="alt-actions">
                        <button className="btn accent sm" onClick={() => choose(a, alt)}>
                          <Check size={15} /> Elegir esta
                        </button>
                        {p.reserve?.url && !/sin reserva/i.test(p.reserve.platform) && (
                          <a className="btn ghost sm" href={p.reserve.url} target="_blank" rel="noreferrer">
                            <Ticket size={14} /> Reservar
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Sheet>
  );
}
