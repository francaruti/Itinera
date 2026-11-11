/**
 * PUNTO ÚNICO DE PERSONALIZACIÓN DE LA PLANTILLA.
 *
 * Lo que cambias al adaptar la app para tu marca vive aquí: nombre, correo de contacto y qué servicios
 * reales están conectados (bloque `conexiones`). La interfaz y los textos legales leen estos valores;
 * no escribas el nombre de la app ni el correo a mano en otras pantallas.
 * `npm run verificar` lee este archivo: el bloque `conexiones` debe tener esa forma exacta.
 */

/**
 * Servicios reales conectados. Forma fija en toda la familia de plantillas.
 * Esta app no usa Supabase, Hotmart ni Resend, así que están en `false`.
 * - supabase: base de datos y cuentas en la nube (aquí, Postgres opcional con DATABASE_URL; ver docs/CONECTAR.md).
 * - hotmart: cobros (esta app no cobra).
 * - resend: correo (esta app no envía correos).
 */
export type Conexiones = { supabase: boolean; hotmart: boolean; resend: boolean };

export const plantilla = {
  /**
   * Nombre de la app: cabecera, pestaña del navegador, instalación, textos legales y web/index.html y el manifiesto
   * de la PWA (ambos se generan desde este archivo en web/vite.config.ts).
   */
  nombre: 'Itinova',
  /** Frase corta que sigue al nombre en el título de la pestaña y en la instalación. */
  eslogan: 'Tu viaje, organizado',
  /** Descripción para buscadores y la instalación de la PWA. */
  descripcion: 'Planifica tu viaje día a día: itinerario, reservas, presupuesto y clima, en un solo lugar.',
  /**
   * Correo de contacto que ven las personas en los textos legales.
   * «correo@correo.com» es solo un ejemplo: cámbialo por un correo tuyo antes de publicar.
   */
  contactoEmail: 'itinova@creativas.app',
  /**
   * Garantía de reembolso que ofrece quien vende la app. Si el cobro va por Hotmart, el reembolso dentro de este plazo
   * lo gestiona Hotmart. La app no cobra: el texto de Términos lo aclara. Cambia el número aquí, no en la interfaz.
   */
  garantiaDias: 15,
  /**
   * Días de prueba que se anuncian en la portada, el onboarding y el README. La app no cobra ni controla la prueba:
   * debe coincidir con la prueba de tu oferta en Hotmart. Cambia el número aquí, no en la interfaz.
   */
  pruebaDias: 7,
  /**
   * Enlace de compra en Hotmart (https://…). Vacío = la página de venta no muestra el botón de compra
   * y muestra la nota de demostración. Con enlace, el botón aparece con data-evento="inicio-compra".
   */
  enlaceCompra: '' as string,
  /**
   * Precios mostrados en pesos chilenos (CLP). El cobro se hace en dólares (USD) a través de Hotmart, y el monto puede variar según el tipo de cambio. El anual equivale a 10 mensualidades y la portada lo presenta
   * como «dos meses gratis». Precios sugeridos: confirma tu oferta en Hotmart antes de vender. Cambia las cifras aquí
   * y en tu oferta a la vez.
   */
  precios: { moneda: 'CLP', cobro: 'USD', mensual: 4990, anual: 49900 },
  anioCopyright: 2026,
  /** Servicios reales conectados. Todo en `false` = la app funciona con datos guardados en tu servidor. */
  conexiones: { supabase: false, hotmart: false, resend: false } as Conexiones,
} as const;

/** Atajo al bloque `conexiones`. */
export const conexiones: Conexiones = plantilla.conexiones;

/** Interruptor de la IA (no hay IA conectada). Su implementación iría solo en el servidor. */
export const iaConectada: boolean = false;
