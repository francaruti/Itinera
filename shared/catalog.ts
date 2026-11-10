import type { ActivityCategory, City } from './types';

/** Horario por día de la semana: `[abre, cierra]` ("HH:mm"; cierre > 24:00 = después de medianoche), `null` = cerrado, ausente = desconocido. */
export interface Hours {
  mon?: [string, string] | null;
  tue?: [string, string] | null;
  wed?: [string, string] | null;
  thu?: [string, string] | null;
  fri?: [string, string] | null;
  sat?: [string, string] | null;
  sun?: [string, string] | null;
  notes?: string;
}

export interface Reserve {
  url: string;
  platform: string;
  /** true = obligatorio, 'recomendado', false = no hace falta (o no acepta). */
  needed: boolean | 'recomendado';
  opensDaysAhead?: number;
}

/** Un lugar con todo lo necesario para decidir y actuar: horario, espera, precio, reserva y por qué ir. */
export interface CatalogPlace {
  id: string;
  name: string;
  aliases?: string[];
  city: City;
  category: ActivityCategory;
  /** Momento o tipo de plan: breakfast|lunch|dinner|snack|dessert|view|museum|walk|ferry|shopping|show|ride|morning|afternoon|evening|any… */
  slot: string;
  /** Parque o zona grande (para no mezclar atracciones de parques distintos). */
  park?: string;
  area?: string;
  cluster?: string;
  address: string;
  lat: number;
  lng: number;
  hours?: Hours | null;
  /** Duración típica de la visita, incluyendo espera. */
  minutes: number;
  waitMinutes?: { typical: number; peak: number } | null;
  /** Costo aproximado por persona en USD. */
  priceUsd?: number | null;
  priceNote?: string;
  rating?: number | null;
  ratingSource?: string;
  reserve?: Reserve | null;
  url?: string;
  why: string;
  tips: string[];
  bestTime?: string;
  /** Clave en shared/photos.json. */
  photo?: string;
  lightningLane?: string;
  expressTier?: string;
  heightIn?: number | null;
  thrill?: string;
  sources?: string[];
  verifiedOn?: string;
  confidence?: 'alta' | 'media' | 'baja';
}
