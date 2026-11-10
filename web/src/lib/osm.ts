import type { ActivityCategory, City } from '../../../shared/types';
import { guessCategory } from './guess';

/** Categoría de actividad sugerida a partir de la clasificación de OpenStreetMap ("tourism/museum"). */
export function categoryFromOsm(osm: string | undefined, name: string): ActivityCategory {
  const [cls = '', type = ''] = (osm ?? '').split('/');
  if (type === 'theme_park' || type === 'zoo' || type === 'aquarium' || type === 'water_park') return 'park';
  if (cls === 'tourism' && ['hotel', 'hostel', 'motel', 'guest_house', 'apartment', 'resort'].includes(type)) return 'lodging';
  if (cls === 'tourism' || cls === 'historic') return 'sight';
  if (cls === 'amenity' && ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'ice_cream', 'biergarten'].includes(type)) return 'food';
  if (cls === 'amenity' && ['theatre', 'cinema', 'arts_centre', 'nightclub'].includes(type)) return 'show';
  if (cls === 'amenity' && ['bus_station', 'ferry_terminal'].includes(type)) return 'transport';
  if (cls === 'shop') return 'shopping';
  if (cls === 'leisure' && ['park', 'garden', 'nature_reserve', 'marina'].includes(type)) return 'sight';
  if (cls === 'aeroway' || cls === 'railway' || cls === 'public_transport') return 'transport';
  return guessCategory(name);
}

/**
 * Atajos de búsqueda por ciudad para descubrir lugares sin escribir (opcional).
 * Ejemplo: { miami: ['South Beach', 'Wynwood Walls'] }. La plantilla los deja vacíos.
 */
export const PLACE_SUGGESTIONS: Partial<Record<City, string[]>> = {};
