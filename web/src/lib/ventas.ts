import { CITY_META } from '../../../shared/constants';
import { plantilla } from '../../../shared/plantilla';
import { distanceKm } from './schedule';

/** Pantalla pública o de acceso según el hash. La portada es #/ (o sin hash); el resto de hashes son de la app. */
export type Pantalla = 'venta' | 'empezar' | 'acceso' | 'app';

export function pantallaDesdeHash(hash: string): Pantalla {
  const ruta = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (ruta === '' || ruta === 'venta') return 'venta';
  if (ruta === 'empezar') return 'empezar';
  if (ruta === 'acceso') return 'acceso';
  return 'app';
}

/** Destino de «Ya tengo acceso» y de «Saltar»: con control de acceso, #/acceso; sin él, directo al itinerario. */
export function destinoAcceso(conAcceso: boolean): string {
  return conAcceso ? '#/acceso' : '#/itinerario';
}

/** Enlace final del onboarding: su texto y su destino dependen de si hay control de acceso. */
export function destinoFinalOnboarding(conAcceso: boolean): { texto: string; href: string } {
  return conAcceso ? { texto: 'Ir al acceso', href: '#/acceso' } : { texto: 'Ir al itinerario', href: '#/itinerario' };
}

export type Vista = 'error' | 'cargando' | 'venta' | 'bienvenida' | 'acceso' | 'app';

/**
 * Qué pantalla mostrar según el estado de la app y la ruta.
 * - La portada (#/) se muestra siempre que no haya sesión. Sin control de acceso no hay sesión, así que se ve igual.
 * - Mientras no se sabe si hay control de acceso (`authChecked` falso) y la app ya tiene datos guardados, se muestra la app
 *   para no mostrar la portada por un instante a quien tiene sesión.
 */
export function elegirVista(p: {
  status: 'loading' | 'ready' | 'locked' | 'error';
  ruta: Pantalla;
  authRequired: boolean;
  authChecked: boolean;
}): Vista {
  if (p.status === 'error') return 'error';
  if (p.status === 'loading') return 'cargando';
  if (p.status === 'locked') {
    if (p.ruta === 'empezar') return 'bienvenida';
    if (p.ruta === 'venta') return 'venta';
    return 'acceso';
  }
  if (p.ruta === 'venta') return p.authRequired || !p.authChecked ? 'app' : 'venta';
  if (p.ruta === 'empezar') return !p.authRequired && p.authChecked ? 'bienvenida' : 'app';
  return 'app';
}

/** Enlace de compra válido (https) o null. Sin enlace no aparece el botón de compra. */
export function enlaceCompra(url: string = plantilla.enlaceCompra): string | null {
  const limpio = url.trim();
  if (!limpio) return null;
  try {
    return new URL(limpio).protocol === 'https:' ? limpio : null;
  } catch {
    return null;
  }
}

/** Precio para la portada con dos decimales siempre («$49.90»), como manda la plantilla de precios. */
const formatoPrecio = new Intl.NumberFormat('es-ES', { style: 'currency', currency: plantilla.precios.moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const precioTexto = (cantidad: number): string => formatoPrecio.format(cantidad);

/* Copy de la página de venta y del onboarding. Solo lo que la app hace hoy. */

export const TITULAR = 'Organiza tu viaje día por día';
export const SUBTITULO = 'Ordena tus planes, guarda reservas y controla gastos. Tú haces las reservas con cada proveedor.';

export const BENEFICIOS = [
  {
    titulo: 'Itinerario día a día',
    texto: 'Planes por día, con hora, lugar y notas.',
  },
  {
    titulo: 'Reservas y pendientes a la vista',
    texto: 'Vuelos, hoteles y entradas con sus comprobantes y pendientes.',
  },
  {
    titulo: 'Mapa, clima y presupuesto',
    texto: 'Rutas, clima y gastos frente a tu presupuesto.',
  },
];

export const PASOS_VENTA = [
  { titulo: 'Crea tu viaje', texto: 'Añade viajeros, días y ciudades.' },
  { titulo: 'Llena cada día', texto: 'Añade actividades con hora y lugar, y márcalas cuando ya las hiciste.' },
  { titulo: 'Revisa lo que falta', texto: 'Inicio muestra los vuelos, hoteles y pendientes que aún necesitan datos o archivos.' },
];

export const PREGUNTAS = [
  {
    pregunta: '¿Funciona sin conexión?',
    respuesta:
      'Lo último que abriste queda guardado en el dispositivo, así que puedes ver el viaje sin señal. Si editas sin conexión, los cambios se envían cuando vuelve internet.',
  },
  {
    pregunta: '¿Dónde se guardan mis datos?',
    respuesta:
      'En el servidor donde se instala la app, con SQLite o Postgres. Los servicios de clima, búsqueda y rutas reciben solo lo que necesitan para responder. Lo detallado está en Privacidad.',
  },
  {
    pregunta: '¿Pueden entrar mis compañeros de viaje?',
    respuesta:
      'Sí. Quien administra el viaje agrega sus correos. Cada persona crea su contraseña con el código de invitación, y solo entran las que están agregadas.',
  },
  {
    pregunta: '¿Cuánto cuesta?',
    respuesta: 'Hay un plan mensual y uno anual, con los precios de esta página. La forma de pago y el total final aparecen en la página de compra de Hotmart.',
  },
  {
    pregunta: '¿Y si no me convence?',
    respuesta: `Tienes garantía de ${plantilla.garantiaDias} días. Si compras por Hotmart, la solicitud dentro de ese plazo se tramita con Hotmart.`,
  },
];

/** Pasos del onboarding para quien entra por primera vez, antes de crear la contraseña. */
export const PASOS_BIENVENIDA = [
  {
    id: 'viaje',
    titulo: 'Tu viaje',
    texto: 'Al entrar podrás ponerle nombre y añadir viajeros. Cada día tendrá su fecha y ciudad.',
    muestra: ['Nombre del viaje', 'Viajeros', 'Fecha y ciudad por día'],
  },
  {
    id: 'dias',
    titulo: 'Tus días',
    texto: 'Dentro del itinerario podrás añadir planes con hora y lugar, y marcarlos al completarlos.',
    muestra: ['Hora', 'Lugar', 'Notas', 'Hecho'],
  },
  {
    id: 'reservas',
    titulo: 'Tus reservas y pendientes',
    texto: 'Guarda tus comprobantes. La app organiza tus reservas; no las compra por ti.',
    muestra: ['Vuelos', 'Hoteles', 'Entradas', 'Pendientes'],
  },
];

/**
 * Dato de la tarjeta flotante de la portada: el mismo día y la misma actividad que muestra la captura del héroe.
 * Si cambias el viaje inicial de server/src/seed.ts, cambia también esta tarjeta (lo vigila test/ventas.test.ts).
 */
export const DATO_HERO = {
  dia: 'Día 1 · Llegada y primer paseo',
  hora: '16:00',
  linea: 'Paseo por el centro de la ciudad',
};

/** Trazo de la firma: tres paradas de la app y la distancia en línea recta entre las dos que se unen. */
export const PARADAS_FIRMA = ['orlando', 'miami', 'keywest'] as const;

export function tramosFirma(): Array<{ desde: string; hasta: string; km: number }> {
  return PARADAS_FIRMA.slice(0, -1).map((clave, i) => {
    const desde = CITY_META[clave];
    const hasta = CITY_META[PARADAS_FIRMA[i + 1]];
    return { desde: desde.name, hasta: hasta.name, km: Math.round(distanceKm(desde, hasta)) };
  });
}

/** Palabras que no deben aparecer en la página de venta ni en el onboarding. */
export const PALABRAS_PROHIBIDAS = ['ejemplo', 'ejemplos', 'ficticio', 'de muestra'] as const;
