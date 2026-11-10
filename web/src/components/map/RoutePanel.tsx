import { Bike, Bus, Car, ChevronDown, Footprints, Hotel, LocateFixed, MapPinned, Navigation, Plane, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { formatTime12, nowInZone, timeToMinutes } from '../../../../shared/time';
import { MODE_META, formatDistance, formatDuration, type LocStatus, type TravelMode, LOC_HELP } from '../../lib/geo';
import type { RouteSet } from '../../lib/routing';
import type { Dest, Origin, OriginKind } from './types';

const ICON: Record<TravelMode, LucideIcon> = { foot: Footprints, bike: Bike, car: Car, plane: Plane };
const ORDER: TravelMode[] = ['foot', 'bike', 'car', 'plane'];

interface Props {
  dest: Dest;
  origin: Origin | null;
  originKind: OriginKind;
  routes: RouteSet | null;
  loading: boolean;
  mode: TravelMode;
  tz: string;
  locStatus: LocStatus;
  hasHotel: boolean;
  onMode(m: TravelMode): void;
  onOrigin(k: OriginKind): void;
  onRequestLocation(): void;
  onClose(): void;
}

const gmaps = (origin: Origin | null, dest: Dest, mode: string) =>
  `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin.lat},${origin.lng}` : ''}&destination=${dest.lat},${dest.lng}&travelmode=${mode}`;

function arrival(tz: string, sec: number): string {
  const now = nowInZone(tz);
  const mins = timeToMinutes(now.time) + Math.round(sec / 60);
  const days = Math.floor(mins / 1440);
  const t = `${String(Math.floor((mins % 1440) / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return `${formatTime12(t)}${days > 0 ? ` (+${days} d)` : ''}`;
}

/** Cuánto se tarda a pie, en bici, en carro y en avión; con la ruta dibujada en el mapa. */
export function RoutePanel({ dest, origin, originKind, routes, loading, mode, tz, locStatus, hasHotel, onMode, onOrigin, onRequestLocation, onClose }: Props) {
  const [pick, setPick] = useState(false);
  const cur = routes?.[mode] ?? null;
  const failed = originKind === 'me' && !origin && locStatus !== 'idle' && locStatus !== 'asking' && locStatus !== 'ready';

  return (
    <section className="rp" aria-label="Cómo llegar">
      <header className="rp-head">
        <div className="rp-dest">
          <small>Destino</small>
          <h3 className="clamp-2">{dest.name}</h3>
          {dest.address && <span className="clamp-1 muted">{dest.address}</span>}
        </div>
        <button type="button" className="rp-x" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </header>

      <div className="rp-from">
        <button type="button" className="rp-from-btn" onClick={() => setPick((p) => !p)} aria-expanded={pick}>
          <small>Desde</small>
          <strong className="clamp-1">{origin?.label ?? (originKind === 'me' ? 'Mi ubicación' : originKind === 'hotel' ? 'Mi hotel' : 'Punto del mapa')}</strong>
          <ChevronDown size={16} />
        </button>
        {pick && (
          <div className="rp-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => (setPick(false), onOrigin('me'))}>
              <LocateFixed size={16} /> Mi ubicación
            </button>
            <button type="button" role="menuitem" disabled={!hasHotel} onClick={() => (setPick(false), onOrigin('hotel'))}>
              <Hotel size={16} /> Mi hotel
            </button>
            <button type="button" role="menuitem" onClick={() => (setPick(false), onOrigin('pin'))}>
              <MapPinned size={16} /> Elegir en el mapa
            </button>
          </div>
        )}
      </div>

      {!origin ? (
        <div className="rp-need">
          {failed ? <p>{LOC_HELP[locStatus as keyof typeof LOC_HELP]}</p> : <p>{locStatus === 'asking' ? 'Buscando tu ubicación…' : 'Para calcular el tiempo necesito saber desde dónde sales.'}</p>}
          <div className="rp-need-actions">
            <button type="button" className="btn accent sm" onClick={onRequestLocation} disabled={locStatus === 'asking'}>
              <LocateFixed size={15} /> {locStatus === 'asking' ? 'Buscando…' : 'Usar mi ubicación'}
            </button>
            {hasHotel && (
              <button type="button" className="btn sm" onClick={() => onOrigin('hotel')}>
                <Hotel size={15} /> Salir del hotel
              </button>
            )}
            <button type="button" className="btn sm" onClick={() => onOrigin('pin')}>
              <MapPinned size={15} /> Elegir en el mapa
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rp-modes" role="tablist" aria-label="Medio de transporte">
            {ORDER.map((m) => {
              const r = routes?.[m] ?? null;
              const Icon = ICON[m];
              const dis = !loading && !!routes && !r;
              return (
                <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={!!dis} className={`rp-mode${mode === m ? ' on' : ''}`} style={{ ['--mc' as string]: MODE_META[m].color }} onClick={() => onMode(m)}>
                  <Icon size={20} />
                  <strong>{loading || !routes ? '…' : r && !(m === 'plane' && r.tooShort) ? `${r.approx ? '~' : ''}${formatDuration(r.duration)}` : '—'}</strong>
                  <small>{MODE_META[m].label}</small>
                </button>
              );
            })}
          </div>

          <div className="rp-sum" aria-live="polite">
            {loading || !routes ? (
              <span className="muted">Calculando rutas…</span>
            ) : cur ? (
              <>
                <span>
                  <strong>{formatDuration(cur.duration)}</strong> {MODE_META[mode].verb} · {formatDistance(cur.distance)}
                </span>
                <span className="muted">Llegarías ≈ {arrival(tz, cur.duration)}</span>
              </>
            ) : (
              <span className="muted">No hay ruta {MODE_META[mode].verb} entre estos dos puntos. {mode !== 'plane' && routes.plane ? 'Prueba con el avión.' : ''}</span>
            )}
          </div>
          {cur?.approx && <p className="rp-note">Sin conexión: tiempo aproximado en línea recta.</p>}
          {mode === 'plane' && cur && (
            <p className="rp-note">
              {cur.tooShort ? 'Está muy cerca para volar: mejor ve a pie o en carro. ' : ''}
              Estimación de un vuelo directo en línea recta (≈800 km/h) más ~45 min de rodaje y despegue; revisa los vuelos reales.
            </p>
          )}
          {mode === 'car' && cur && !cur.approx && <p className="rp-note">Sin tráfico. En hora pico puede tardar más.</p>}

          <div className="rp-actions">
            <a className="btn accent sm" href={gmaps(origin, dest, MODE_META[mode === 'plane' ? 'car' : mode].gmaps)} target="_blank" rel="noreferrer">
              <Navigation size={15} /> Abrir en Google Maps
            </a>
            <a className="btn sm" href={gmaps(origin, dest, 'transit')} target="_blank" rel="noreferrer">
              <Bus size={15} /> Metro y bus
            </a>
          </div>
        </>
      )}
    </section>
  );
}
