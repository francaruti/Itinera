/** Contrato de datos compartido entre el servidor y la web. */

/** Destinos de origen (los de ejemplo). Cualquier otro lugar se agrega desde la búsqueda y se guarda en el viaje. */
export const CITIES = ['ny', 'orlando', 'miami', 'tampa', 'keywest', 'washington', 'boston', 'philadelphia'] as const;
/** Clave de un destino: `CITIES` para los de ejemplo, o un identificador creado a partir del nombre (p. ej. `roma-italia`). */
export type City = string;

/** Datos de un destino: nombre, código corto, coordenadas y color de acento (`ne` azul, `south` celeste). */
export interface CityMeta {
  name: string;
  short: string;
  lat: number;
  lng: number;
  region: 'ne' | 'south';
}

export const ACTIVITY_CATEGORIES = [
  'sight',
  'food',
  'transport',
  'lodging',
  'park',
  'shopping',
  'show',
  'rest',
  'other',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const BOOKING_STATUSES = ['none', 'todo', 'booked'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const RESERVATION_KINDS = ['flight', 'hotel', 'ticket', 'other'] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];

export const RESERVATION_STATUSES = ['booked', 'pending', 'todo'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const CHECKLIST_LISTS = ['pending', 'packing'] as const;
export type ChecklistList = (typeof CHECKLIST_LISTS)[number];

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'lodging',
  'tickets',
  'shopping',
  'show',
  'tech',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** La app maneja solo dólares. Se mantiene la lista para que el servidor rechace cualquier otra moneda. */
export const CURRENCIES = ['USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Trip {
  name: string;
  timezone: string;
  /** Presupuesto total en USD. */
  budgetUsd: number;
  travelers: string[];
  /** Derivados de los días. */
  startDate: string;
  endDate: string;
}

export interface Day {
  /** YYYY-MM-DD, clave primaria. */
  date: string;
  city: City;
  travel: boolean;
  title: string;
  notes: string;
}

export interface Activity {
  id: string;
  dayDate: string;
  /** Posición fraccionaria (permite reordenar con un solo PATCH). */
  position: number;
  /** HH:mm (24 h) o vacío. */
  time: string;
  text: string;
  done: boolean;
  category: ActivityCategory;
  place: string;
  lat: number | null;
  lng: number | null;
  /** Costo estimado en USD. */
  cost: number | null;
  booking: BookingStatus;
  url: string;
  notes: string;
}

export interface ChecklistItem {
  id: string;
  list: ChecklistList;
  text: string;
  done: boolean;
  category: string;
  position: number;
}

export interface Reservation {
  id: string;
  kind: ReservationKind;
  title: string;
  provider: string;
  /** Número de vuelo (solo vuelos), p. ej. «B6 83». */
  flightNo: string;
  confirmation: string;
  /** YYYY-MM-DDTHH:mm en hora local del destino, o vacío. */
  startsAt: string;
  endsAt: string;
  city: City;
  address: string;
  amount: number | null;
  currency: Currency;
  status: ReservationStatus;
  paid: boolean;
  url: string;
  notes: string;
  position: number;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: Currency;
  paidBy: string;
}

/** Archivo adjunto a una reserva (captura de Booking, pase de abordar, PDF…). El contenido se pide aparte. */
export interface Attachment {
  id: string;
  reservationId: string;
  name: string;
  /** Nombre o persona a quien pertenece (p. ej. «Pase de Ana»). Opcional. */
  label: string;
  mime: string;
  size: number;
  createdAt: number;
}

export type UserRole = 'admin' | 'member';
export interface AccountUser {
  id: string;
  email: string;
  role: UserRole;
  /** false mientras la persona no haya definido su contraseña (primer ingreso pendiente). */
  hasPassword: boolean;
  lastLogin: number | null;
}

export interface Snapshot {
  rev: number;
  trip: Trip;
  days: Day[];
  activities: Activity[];
  checklist: ChecklistItem[];
  reservations: Reservation[];
  expenses: Expense[];
  attachments: Attachment[];
  /** Destinos creados por el viaje (los de ejemplo ya vienen en shared/constants.ts). */
  destinos?: Record<string, CityMeta>;
}

export type EntityName = 'trip' | 'day' | 'activity' | 'checklist' | 'reservation' | 'expense';

export interface Op {
  entity: EntityName;
  action: 'put' | 'patch' | 'delete';
  /** Para `day` es la fecha; para `trip` se ignora. */
  id: string;
  data?: Record<string, unknown>;
}

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  rain: number | null;
  sunset: string | null;
  sunrise?: string | null;
  /** Sensación térmica máxima / mínima (°C). */
  feelsMax?: number;
  feelsMin?: number;
  uv?: number | null;
  /** Viento máximo (km/h) y precipitación acumulada (mm). */
  windMax?: number | null;
  precip?: number | null;
  humidity?: number | null;
}
/** Un punto por hora: temperatura °C, viento km/h, probabilidad de lluvia %, humedad %. */
export interface HourPoint {
  /** HH:mm en hora local del destino. */
  t: string;
  temp: number;
  feels: number;
  rain: number;
  code: number;
  wind: number;
  hum: number;
  uv: number;
}
export interface CurrentWeather {
  temp: number;
  feels: number;
  code: number;
  wind: number;
  hum: number;
  /** YYYY-MM-DDTHH:mm */
  time: string;
}
export interface WeatherPayload {
  fetchedAt: number;
  stale?: boolean;
  cities: Partial<Record<City, WeatherDay[]>>;
  /** Pronóstico por hora, indexado por fecha, solo de los días del viaje. */
  hourly?: Partial<Record<City, Record<string, HourPoint[]>>>;
  current?: Partial<Record<City, CurrentWeather>>;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  /** Nombre corto del lugar y dirección legible. */
  name?: string;
  address?: string;
  /** Clase y tipo de OpenStreetMap (p. ej. tourism/museum). */
  osm?: string;
}
