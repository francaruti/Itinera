import { BadgeCheck, Clock, ExternalLink, Footprints, Lightbulb, MapPin, Navigation, Pencil, Replace, Star, Ticket, Timer, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { CITY_META } from '../../../../shared/constants';
import { formatTime12, longDate } from '../../../../shared/time';
import { directionsUrl, mapsSearchUrl, money } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/meta';
import { op } from '../../lib/ops';
import { photo, photoForActivity } from '../../lib/photos';
import { bookingUrl, ctaLabel, placeInfoFor, wantsBooking } from '../../lib/placeinfo';
import { CATALOG_INDEX } from '../../lib/placeinfo';
import { alternativesFor, distanceKm, travelLabel } from '../../lib/schedule';
import { CATALOG } from '../../lib/catalog';
import { useStore } from '../../store';
import { Photo } from '../photos/Photo';
import { Sheet } from '../ui/Sheet';
import { Clamp } from '../ui/Clamp';

/** Detalle de un plan: lo esencial arriba y UNA acción principal (reservar / entradas); el resto, a un toque. */
export default function PlaceSheet({ onEdit }: { onEdit(id: string): void }) {
  const snap = useStore((s) => s.snap)!;
  const id = useStore((s) => s.detailId);
  const close = useStore((s) => s.openDetail);
  const openAlts = useStore((s) => s.openAlts);
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const a = snap.activities.find((x) => x.id === id) ?? null;

  const info = useMemo(() => (a ? placeInfoFor(a) : null), [a]);
  const place = info?.place ?? null;
  const altCount = useMemo(() => (a ? alternativesFor(a, snap, CATALOG, CATALOG_INDEX).length : 0), [a, snap]);

  // Un restaurante no lleva foto de monumento por coincidencia de palabras (p. ej. "Times Square").
  const img = a ? (place?.photo ? photo(place.photo) : null) ?? (place?.category === 'food' ? null : photoForActivity(a)) : null;
  const Icon = a ? CATEGORY_ICON[place?.category ?? a.category] : MapPin;
  const url = a ? bookingUrl(place, a) : '';
  const needsBooking = a ? wantsBooking(place, a) : false;
  const lat = a?.lat ?? place?.lat;
  const lng = a?.lng ?? place?.lng;

  // Cómo llegar desde el plan anterior: distancia real, no solo "abre el mapa".
  const fromPrev = useMemo(() => {
    if (!a || lat == null || lng == null) return null;
    const ordered = snap.activities.filter((x) => x.dayDate === a.dayDate).sort((x, y) => x.position - y.position);
    const i = ordered.findIndex((x) => x.id === a.id);
    for (let k = i - 1; k >= 0; k--) {
      const p = ordered[k];
      if (p.lat != null && p.lng != null) return { name: p.place || p.text, label: travelLabel(distanceKm({ lat: p.lat, lng: p.lng }, { lat, lng })) };
    }
    return null;
  }, [a, snap.activities, lat, lng]);

  const day = a ? snap.days.find((d) => d.date === a.dayDate) : null;

  return (
    <Sheet open={!!a} onClose={() => close(null)} title={a?.text ?? ''} hideHeader wide>
      {a && (
        <div className="ps">
          {img && (
            <div className="ps-cover">
              <Photo photo={img} width={960} eager zoom alt={img.name} />
            </div>
          )}
          <div className="ps-head">
            <span className={`cat-badge cat-${place?.category ?? a.category} lg`}>
              <Icon size={18} />
            </span>
            <div className="grow">
              <small className="muted">
                {longDate(a.dayDate)}
                {a.time ? ` · ${formatTime12(a.time)}` : ''}
                {day ? ` · ${CITY_META[day.city].name}` : ''}
              </small>
              <h2 className="ps-title">{a.text}</h2>
              {(a.place || place?.area) && (
                <small className="muted">
                  <MapPin size={12} /> {[a.place || place?.name, place?.area].filter(Boolean).join(' · ')}
                </small>
              )}
            </div>
            <button className="icon-btn" onClick={() => close(null)} aria-label="Cerrar">
              ✕
            </button>
          </div>

          {(info?.open || place) && (
            <div className="ps-facts">
              {info?.open && (
                <span className={`chip ${info.open.state === 'open' ? 'ok' : info.open.state === 'closed' ? 'todo' : ''}`}>
                  <Clock size={13} /> {info.open.label}
                </span>
              )}
              {place?.rating != null && (
                <span className="chip">
                  <Star size={13} /> {place.rating.toFixed(1)}
                </span>
              )}
              {place?.waitMinutes && (
                <span className="chip">
                  <Timer size={13} /> Espera ~{place.waitMinutes.typical} min
                </span>
              )}
              {place?.priceUsd != null && (
                <span className="chip">
                  <Wallet size={13} /> {money(place.priceUsd)} p. p.
                </span>
              )}
              {fromPrev && (
                <span className="chip">
                  <Footprints size={13} /> {fromPrev.label}
                </span>
              )}
            </div>
          )}

          {place?.why && <Clamp className="ps-why">{place.why}</Clamp>}

          {place && (place.tips.length > 0 || place.bestTime) && (
            <ul className="ps-tips">
              {place.bestTime && (
                <li>
                  <Clock size={15} /> <Clamp as="span" className="tip-text">{`Mejor momento: ${place.bestTime}`}</Clamp>
                </li>
              )}
              {place.tips.slice(0, 6).map((t) => (
                <li key={t}>
                  <Lightbulb size={15} /> <Clamp as="span" className="tip-text">{t}</Clamp>
                </li>
              ))}
            </ul>
          )}

          {a.notes && !place?.why?.includes(a.notes) && <Clamp className="ps-notes">{a.notes}</Clamp>}

          {place?.reserve && place.reserve.needed !== false && place.reserve.opensDaysAhead != null && (
            <p className="muted small">Las reservas abren {place.reserve.opensDaysAhead} días antes.</p>
          )}
          {place?.reserve && /sin reserva/i.test(place.reserve.platform) && <p className="muted small">No acepta reservas: llega temprano o fuera de hora pico.</p>}

          {/* Acción principal */}
          <div className="ps-actions">
            {url && needsBooking ? (
              <a className="btn accent block lg" href={url} target="_blank" rel="noreferrer" onClick={() => a.booking === 'none' && dispatch(op.activity.patch(a.id, { booking: 'todo' }))}>
                <Ticket size={18} /> {ctaLabel(place, a)}
              </a>
            ) : url ? (
              <a className="btn accent block lg" href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={18} /> Ver sitio oficial
              </a>
            ) : null}

            {needsBooking && (
              <button
                className={`btn block ${a.booking === 'booked' ? 'ok-btn' : 'ghost'}`}
                onClick={() => {
                  dispatch(op.activity.patch(a.id, { booking: a.booking === 'booked' ? 'todo' : 'booked' }));
                  toast(a.booking === 'booked' ? 'Marcado como pendiente' : 'Reserva marcada como lista ✓', 'success');
                }}
              >
                <BadgeCheck size={17} /> {a.booking === 'booked' ? 'Reservado — toca para deshacer' : 'Ya reservé'}
              </button>
            )}

            <div className="ps-row">
              {lat != null && lng != null ? (
                <a className="btn ghost" href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer">
                  <Navigation size={16} /> Cómo llegar
                </a>
              ) : a.place ? (
                <a className="btn ghost" href={mapsSearchUrl(a.place)} target="_blank" rel="noreferrer">
                  <MapPin size={16} /> Ver en mapa
                </a>
              ) : null}
              {altCount > 0 && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    close(null);
                    openAlts(a.id);
                  }}
                >
                  <Replace size={16} /> Alternativas
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  close(null);
                  onEdit(a.id);
                }}
              >
                <Pencil size={16} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
