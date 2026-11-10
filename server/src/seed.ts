import type { ActivityCategory, BookingStatus, City, ReservationKind, ReservationStatus } from '../../shared/types';

/**
 * Datos de ejemplo de la plantilla: un viaje genérico de 5 días que empieza dentro de una semana.
 * No incluye reservas reales, códigos, direcciones ni nombres de personas.
 * Para tu viaje, cambia el nombre desde Ajustes y las fechas, ciudades y actividades desde la app.
 */

/** Ciudad del ejemplo: una de `CITIES` (su nombre y coordenadas están en shared/constants.ts). */
const CITY: City = 'miami';
/** Zona horaria del destino (IANA). Se usa para la cuenta regresiva, el clima y el calendario .ics. */
const TIMEZONE = 'America/New_York';
const TRIP_NAME = 'Mi viaje';

/** Fecha local YYYY-MM-DD, `offset` días después de `hoy`. Así el ejemplo siempre queda como viaje próximo. */
function fechaEjemplo(offset: number, hoy: Date): string {
  const d = new Date(hoy);
  d.setDate(d.getDate() + offset);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface A {
  time: string;
  text: string;
  cat: ActivityCategory;
  booking?: BookingStatus;
  notes?: string;
}
const a = (time: string, text: string, cat: ActivityCategory, extra: Partial<Omit<A, 'time' | 'text' | 'cat'>> = {}): A => ({
  time,
  text,
  cat,
  ...extra,
});

interface D {
  /** Días desde hoy en que empieza el día (el primero es el de llegada). */
  offset: number;
  travel?: boolean;
  title: string;
  notes: string;
  acts: A[];
}

const DAYS: D[] = [
  {
    offset: 7,
    travel: true,
    title: 'Llegada y primer paseo',
    notes: 'Llega con tiempo para el traslado y el registro en el alojamiento.',
    acts: [
      a('', 'Llegada y traslado al alojamiento', 'transport'),
      a('13:00', 'Almuerzo cerca del alojamiento', 'food'),
      a('16:00', 'Paseo por el centro de la ciudad', 'sight'),
      a('20:00', 'Cena', 'food'),
    ],
  },
  {
    offset: 8,
    title: 'Playa y atardecer',
    notes: '',
    acts: [a('09:00', 'Desayuno', 'food'), a('10:00', 'Día de playa', 'park'), a('18:30', 'Ver el atardecer', 'sight')],
  },
  {
    offset: 9,
    title: 'Museos y barrios',
    notes: 'Revisa los horarios de los museos: algunos cierran uno o dos días a la semana.',
    acts: [
      a('10:00', 'Visita a un museo', 'sight', { booking: 'todo', notes: 'Revisa si necesitas comprar la entrada con anticipación.' }),
      a('13:30', 'Almuerzo en un barrio con encanto', 'food'),
      a('16:00', 'Compras en el mercado local', 'shopping'),
    ],
  },
  {
    offset: 10,
    title: 'Día libre',
    notes: 'Un día sin planes fijos para descansar o improvisar.',
    acts: [a('', 'Descanso en el alojamiento', 'rest'), a('20:00', 'Cena de despedida', 'food')],
  },
  {
    offset: 11,
    travel: true,
    title: 'Regreso a casa',
    notes: 'Llega al aeropuerto con el tiempo que pida tu aerolínea.',
    acts: [a('08:00', 'Check-out y traslado al aeropuerto', 'transport'), a('', 'Vuelo de regreso', 'transport', { booking: 'todo' })],
  },
];

interface R {
  kind: ReservationKind;
  title: string;
  /** Días desde hoy del inicio y, si aplica, del fin. */
  from: number;
  to?: number;
  status: ReservationStatus;
  notes: string;
}

/** Reservas por completar: sin proveedor, número de vuelo, código ni dirección. */
const RESERVATIONS: R[] = [
  { kind: 'flight', title: 'Vuelo de ida', from: 7, status: 'todo', notes: 'Añade aerolínea, hora y código de reserva cuando los tengas.' },
  { kind: 'hotel', title: 'Alojamiento', from: 7, to: 11, status: 'todo', notes: 'Añade el nombre, la dirección y el código de reserva del alojamiento.' },
  { kind: 'ticket', title: 'Entrada al museo', from: 9, status: 'todo', notes: 'Compra la entrada con anticipación si el museo lo pide.' },
];

const PENDING: Array<[string, boolean, string]> = [
  ['Definir las fechas del viaje', true, 'Planificación'],
  ['Documento de viaje vigente', false, 'Documentos'],
  ['Seguro de viaje', false, 'Documentos'],
  ['Reservar el vuelo de ida y el de regreso', false, 'Reservas'],
  ['Reservar el alojamiento', false, 'Reservas'],
  ['Avisar al banco del viaje y activar la tarjeta para uso internacional', false, 'Documentos'],
  ['Descargar mapas sin conexión de la ciudad', false, 'Tecnología'],
  ['Revisar la conexión de datos o un plan de datos', false, 'Tecnología'],
];

const PACKING: Array<[string, string]> = [
  ['Documento de viaje', 'Documentos'],
  ['Copia digital de los documentos', 'Documentos'],
  ['Cargador y batería externa', 'Tecnología'],
  ['Audífonos', 'Tecnología'],
  ['Ropa cómoda para caminar', 'Ropa'],
  ['Una prenda de abrigo ligera para las noches', 'Ropa'],
  ['Protector solar y gorra', 'Salud y aseo'],
  ['Medicamentos personales', 'Salud y aseo'],
  ['Botella reutilizable', 'Otros'],
  ['Bolsa pequeña para el día', 'Otros'],
];

const slug = (n: number, prefix: string) => `${prefix}-${String(n).padStart(3, '0')}`;

export function buildSeed() {
  const hoy = new Date();
  const fecha = (offset: number) => fechaEjemplo(offset, hoy);

  const days = DAYS.map((d) => ({ date: fecha(d.offset), city: CITY, travel: !!d.travel, title: d.title, notes: d.notes }));
  const activities = DAYS.flatMap((d) =>
    d.acts.map((act, i) => ({
      id: `seed-${fecha(d.offset)}-${i + 1}`,
      dayDate: fecha(d.offset),
      position: (i + 1) * 10,
      time: act.time,
      text: act.text,
      done: false,
      category: act.cat,
      place: '',
      lat: null,
      lng: null,
      cost: null,
      booking: act.booking ?? 'none',
      url: '',
      notes: act.notes ?? '',
    })),
  );
  const checklist = [
    ...PENDING.map(([text, done, category], i) => ({ id: slug(i + 1, 'seed-todo'), list: 'pending' as const, text, done, category, position: (i + 1) * 10 })),
    ...PACKING.map(([text, category], i) => ({ id: slug(i + 1, 'seed-pack'), list: 'packing' as const, text, done: false, category, position: (i + 1) * 10 })),
  ];
  const reservations = RESERVATIONS.map((r, i) => ({
    id: slug(i + 1, 'seed-res'),
    kind: r.kind,
    title: r.title,
    provider: '',
    flightNo: '',
    confirmation: '',
    startsAt: fecha(r.from),
    endsAt: r.to === undefined ? '' : fecha(r.to),
    city: CITY,
    address: '',
    amount: null,
    currency: 'USD' as const,
    status: r.status,
    paid: false,
    url: '',
    notes: r.notes,
    position: (i + 1) * 10,
  }));
  return {
    trip: { name: TRIP_NAME, timezone: TIMEZONE, budgetUsd: 0, travelers: [] as string[] },
    days,
    activities,
    checklist,
    reservations,
    expenses: [] as never[],
  };
}
