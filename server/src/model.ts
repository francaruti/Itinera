import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  BOOKING_STATUSES,
  CITIES,
  CHECKLIST_LISTS,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  RESERVATION_KINDS,
  RESERVATION_STATUSES,
  type EntityName,
} from '../../shared/types';
import { normalizeTime } from '../../shared/time';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
const isoLocalDateTime = z.string().regex(/^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?)?$/, 'Fecha/hora inválida');
const city = z.enum(CITIES);
const httpUrl = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'La URL debe empezar con http:// o https://');
const money = z.number().finite().min(0).max(10_000_000);

type ColType = 'text' | 'int' | 'bool' | 'real' | 'json';
export interface Col {
  key: string;
  col: string;
  type: ColType;
}
export interface Spec {
  entity: EntityName;
  table: string;
  /** Columna y clave de la clave primaria. */
  pk: string;
  cols: Col[];
  full: z.ZodObject<z.ZodRawShape>;
  patch: z.ZodObject<z.ZodRawShape>;
  /** Orden por defecto al listar. */
  order: string;
}

function spec(
  entity: EntityName,
  table: string,
  pk: string,
  cols: Col[],
  shape: z.ZodRawShape,
  order: string,
): Spec {
  const full = z.object(shape);
  return { entity, table, pk, cols, full, patch: full.partial(), order };
}

const c = (key: string, type: ColType = 'text', col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)): Col => ({
  key,
  col,
  type,
});

export const SPECS: Record<Exclude<EntityName, 'trip'>, Spec> = {
  day: spec(
    'day',
    'days',
    'date',
    [c('city'), c('travel', 'bool'), c('title'), c('notes')],
    {
      city,
      travel: z.boolean().default(false),
      title: z.string().max(200).default(''),
      notes: z.string().max(5000).default(''),
    },
    'date',
  ),
  activity: spec(
    'activity',
    'activities',
    'id',
    [
      c('dayDate'),
      c('position', 'real'),
      c('time'),
      c('text'),
      c('done', 'bool'),
      c('category'),
      c('place'),
      c('lat', 'real'),
      c('lng', 'real'),
      c('cost', 'real'),
      c('booking'),
      c('url'),
      c('notes'),
    ],
    {
      dayDate: isoDate,
      position: z.number().finite().default(0),
      time: z.string().max(10).transform(normalizeTime).default(''),
      text: z.string().trim().min(1, 'La actividad no puede estar vacía').max(500),
      done: z.boolean().default(false),
      category: z.enum(ACTIVITY_CATEGORIES).default('other'),
      place: z.string().max(200).default(''),
      lat: z.number().min(-90).max(90).nullable().default(null),
      lng: z.number().min(-180).max(180).nullable().default(null),
      cost: money.nullable().default(null),
      booking: z.enum(BOOKING_STATUSES).default('none'),
      url: httpUrl.default(''),
      notes: z.string().max(3000).default(''),
    },
    'day_date, position',
  ),
  checklist: spec(
    'checklist',
    'checklist',
    'id',
    [c('list'), c('text'), c('done', 'bool'), c('category'), c('position', 'real')],
    {
      list: z.enum(CHECKLIST_LISTS),
      text: z.string().trim().min(1).max(300),
      done: z.boolean().default(false),
      category: z.string().max(60).default(''),
      position: z.number().finite().default(0),
    },
    'list, position',
  ),
  reservation: spec(
    'reservation',
    'reservations',
    'id',
    [
      c('kind'),
      c('title'),
      c('provider'),
      c('flightNo'),
      c('confirmation'),
      c('startsAt'),
      c('endsAt'),
      c('city'),
      c('address'),
      c('amount', 'real'),
      c('currency'),
      c('status'),
      c('paid', 'bool'),
      c('url'),
      c('notes'),
      c('position', 'real'),
    ],
    {
      kind: z.enum(RESERVATION_KINDS),
      title: z.string().trim().min(1).max(200),
      provider: z.string().max(120).default(''),
      flightNo: z.string().max(40).default(''),
      confirmation: z.string().max(80).default(''),
      startsAt: isoLocalDateTime.default(''),
      endsAt: isoLocalDateTime.default(''),
      city: city.default('ny'),
      address: z.string().max(300).default(''),
      amount: money.nullable().default(null),
      currency: z.enum(CURRENCIES).default('USD'),
      status: z.enum(RESERVATION_STATUSES).default('todo'),
      paid: z.boolean().default(false),
      url: httpUrl.default(''),
      notes: z.string().max(3000).default(''),
      position: z.number().finite().default(0),
    },
    'starts_at, position',
  ),
  expense: spec(
    'expense',
    'expenses',
    'id',
    [c('date'), c('description'), c('category'), c('amount', 'real'), c('currency'), c('paidBy')],
    {
      date: isoDate,
      description: z.string().trim().min(1).max(200),
      category: z.enum(EXPENSE_CATEGORIES).default('other'),
      amount: money,
      currency: z.enum(CURRENCIES).default('USD'),
      paidBy: z.string().max(60).default(''),
    },
    'date, updated_at, id',
  ),
};

export const TRIP_COLS: Col[] = [
  c('name'),
  c('timezone'),
  c('budgetUsd', 'real'),
  c('travelers', 'json'),
];

export const tripPatch = z
  .object({
    name: z.string().trim().min(1).max(120),
    timezone: z.string().max(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Zona horaria inválida'),
    budgetUsd: money,
    travelers: z.array(z.string().trim().min(1).max(40)).max(12),
  })
  .partial();

export const opSchema = z.object({
  entity: z.enum(['trip', 'day', 'activity', 'checklist', 'reservation', 'expense']),
  action: z.enum(['put', 'patch', 'delete']),
  id: z.string().min(1).max(64),
  data: z.record(z.unknown()).optional(),
});
export const opsBody = z.object({ ops: z.array(opSchema).min(1).max(500) });

export const importSchema = z.object({
  trip: tripPatch,
  days: z.array(SPECS.day.full.extend({ date: isoDate })).max(200),
  activities: z.array(SPECS.activity.full.extend({ id: z.string().min(1).max(64) })).max(5000),
  checklist: z.array(SPECS.checklist.full.extend({ id: z.string().min(1).max(64) })).max(1000),
  reservations: z.array(SPECS.reservation.full.extend({ id: z.string().min(1).max(64) })).max(1000),
  expenses: z.array(SPECS.expense.full.extend({ id: z.string().min(1).max(64) })).max(5000),
});
