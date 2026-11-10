import type { CatalogPlace } from '../../../shared/catalog';
import type { Activity, Snapshot } from '../../../shared/types';
import { CATALOG } from './catalog';
import { catalogFor, indexCatalog, openStatus, type OpenState } from './schedule';

export const CATALOG_INDEX = indexCatalog(CATALOG);

export interface PlaceInfo {
  place: CatalogPlace | null;
  open: OpenState | null;
}

export function placeInfoFor(a: Activity): PlaceInfo {
  const place = catalogFor(a, CATALOG_INDEX);
  return { place, open: place ? openStatus(place, a.dayDate, a.time) : null };
}

/** Texto del botón principal según el tipo de lugar. */
export function ctaLabel(place: CatalogPlace | null, a: Activity): string {
  const platform = place?.reserve?.platform ?? '';
  if (place?.category === 'food') return 'Reservar mesa';
  if (/disney|universal/i.test(platform) || place?.category === 'park') return 'Comprar / reservar';
  if (place?.category === 'show') return 'Comprar boletos';
  if (a.booking === 'todo') return 'Reservar';
  return 'Entradas y reservas';
}

/** URL de reserva o compra: la del catálogo manda; si no, la que la persona guardó en la actividad. */
export function bookingUrl(place: CatalogPlace | null, a: Activity): string {
  return place?.reserve?.url || a.url || '';
}

/** ¿Este lugar requiere (o conviene) reservar? Falso para sitios "sin reserva, solo fila". */
export function wantsBooking(place: CatalogPlace | null, a: Activity): boolean {
  if (place?.reserve && place.reserve.needed !== false && !/sin reserva/i.test(place.reserve.platform)) return true;
  return a.booking === 'todo' && !!a.url;
}

export function usedRefs(snap: Snapshot): Set<string> {
  const s = new Set<string>();
  for (const a of snap.activities) {
    const p = catalogFor(a, CATALOG_INDEX);
    if (p) s.add(p.id);
  }
  return s;
}
