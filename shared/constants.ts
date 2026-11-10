import type { ActivityCategory, City, ExpenseCategory, ReservationKind } from './types';
import { plantilla } from './plantilla';

/** Nombre de la app (lo define shared/plantilla.ts). */
export const APP_NAME = plantilla.nombre;

/**
 * Destinos que la app conoce: nombre, código corto y coordenadas (clima, mapa y búsqueda).
 * `region` define el color de acento: noreste = azul real, sur/Florida = celeste.
 */
export const CITY_META: Record<City, { name: string; short: string; lat: number; lng: number; region: 'ne' | 'south' }> = {
  ny: { name: 'Nueva York', short: 'NY', lat: 40.7549, lng: -73.984, region: 'ne' },
  orlando: { name: 'Orlando', short: 'ORL', lat: 28.4237, lng: -81.4677, region: 'south' },
  miami: { name: 'Miami', short: 'MIA', lat: 25.7617, lng: -80.1918, region: 'south' },
  tampa: { name: 'Tampa', short: 'TPA', lat: 27.9506, lng: -82.4572, region: 'south' },
  keywest: { name: 'Cayo Hueso', short: 'KEY', lat: 24.5551, lng: -81.78, region: 'south' },
  washington: { name: 'Washington D. C.', short: 'DC', lat: 38.9072, lng: -77.0369, region: 'ne' },
  boston: { name: 'Boston', short: 'BOS', lat: 42.3601, lng: -71.0589, region: 'ne' },
  philadelphia: { name: 'Filadelfia', short: 'PHL', lat: 39.9526, lng: -75.1652, region: 'ne' },
};

export const ACTIVITY_CATEGORY_LABEL: Record<ActivityCategory, string> = {
  sight: 'Paseo',
  food: 'Comida',
  transport: 'Traslado',
  lodging: 'Hotel',
  park: 'Parque',
  shopping: 'Compras',
  show: 'Show',
  rest: 'Descanso',
  other: 'Otro',
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: 'Comida',
  transport: 'Transporte',
  lodging: 'Hospedaje',
  tickets: 'Entradas',
  shopping: 'Compras',
  show: 'Shows',
  tech: 'Datos / tech',
  other: 'Otros',
};

export const RESERVATION_KIND_LABEL: Record<ReservationKind, string> = {
  flight: 'Vuelos',
  hotel: 'Hoteles',
  ticket: 'Entradas y tours',
  other: 'Otros',
};
