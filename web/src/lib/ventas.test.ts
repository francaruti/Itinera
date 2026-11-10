import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Bienvenida } from '../components/venta/Bienvenida';
import { VentaContenido } from '../components/venta/Venta';
import { plantilla } from '../../../shared/plantilla';
import { buildSeed } from '../../../server/src/seed';
import {
  BENEFICIOS,
  DATO_HERO,
  PALABRAS_PROHIBIDAS,
  PASOS_BIENVENIDA,
  PASOS_VENTA,
  PREGUNTAS,
  destinoAcceso,
  destinoFinalOnboarding,
  elegirVista,
  enlaceCompra,
  pantallaDesdeHash,
  precioTexto,
  tramosFirma,
} from './ventas';

/** Texto visible: sin comentarios de React ni etiquetas. */
const texto = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const marcar = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

const CON_ENLACE = 'https://pay.hotmart.com/prueba-viajes';

describe('rutas sin sesión', () => {
  it('la portada es #/ y también la ausencia de hash', () => {
    expect(pantallaDesdeHash('')).toBe('venta');
    expect(pantallaDesdeHash('#')).toBe('venta');
    expect(pantallaDesdeHash('#/')).toBe('venta');
    expect(pantallaDesdeHash('#/venta')).toBe('venta');
  });

  it('el onboarding y el acceso tienen su propia ruta', () => {
    expect(pantallaDesdeHash('#/empezar')).toBe('empezar');
    expect(pantallaDesdeHash('#/acceso')).toBe('acceso');
    expect(pantallaDesdeHash('#/acceso/')).toBe('acceso');
  });

  it('cualquier otro hash es de la app', () => {
    expect(pantallaDesdeHash('#/itinerario')).toBe('app');
    expect(pantallaDesdeHash('#/mapa')).toBe('app');
  });
});

describe('enlace de compra', () => {
  it('sin enlace, o con un valor que no es https, no hay botón de compra', () => {
    expect(enlaceCompra('')).toBeNull();
    expect(enlaceCompra('   ')).toBeNull();
    expect(enlaceCompra('http://pay.hotmart.com/x')).toBeNull();
    expect(enlaceCompra('javascript:alert(1)')).toBeNull();
    expect(enlaceCompra('https://')).toBeNull();
  });

  it('un enlace https se usa tal cual, sin espacios', () => {
    expect(enlaceCompra(`  ${CON_ENLACE}  `)).toBe(CON_ENLACE);
  });
});

describe('portada', () => {
  it('sin enlace: tres CTA de inicio con data-evento, nota de demostración y sin botón de compra', () => {
    const html = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: null })));
    expect(html.match(/data-evento="inicio-compra"/g)).toHaveLength(3);
    for (const zona of ['arriba', 'medio', 'final']) {
      expect(html).toContain(`id="cta-empezar-${zona}"`);
      expect(html).toContain(`id="cta-acceso-${zona}"`);
    }
    expect(html).toContain('href="#/empezar"');
    expect(html.match(/href="#\/acceso"/g)).toHaveLength(3);
    expect(html).not.toContain('id="cta-comprar"');
    expect(texto(html)).toContain('Demostración: no se cobra nada.');
  });

  it('con enlace: aparece el botón de compra con su id y data-evento, y se quita la nota', () => {
    const html = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: CON_ENLACE })));
    expect(html).toContain(`id="cta-comprar"`);
    expect(html).toContain(`href="${CON_ENLACE}"`);
    expect(html.match(/data-evento="inicio-compra"/g)).toHaveLength(4);
    expect(texto(html)).not.toContain('Demostración');
  });

  it('cada grupo de CTA lleva la garantía de 7 días junto a él', () => {
    const t = texto(renderToStaticMarkup(createElement(VentaContenido, { enlace: null })));
    expect(plantilla.garantiaDias).toBe(7);
    expect(t.match(/Garantía de 7 días/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('los identificadores de CTA son únicos', () => {
    const html = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: CON_ENLACE })));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no usa las palabras prohibidas en su texto visible, con o sin enlace', () => {
    const patron = new RegExp(`\\b(${PALABRAS_PROHIBIDAS.join('|')})\\b`, 'i');
    for (const enlace of [null, CON_ENLACE]) {
      const t = texto(renderToStaticMarkup(createElement(VentaContenido, { enlace })));
      expect(t).not.toMatch(patron);
      expect(t).not.toContain('en un solo lugar');
    }
  });

  it('el copy de beneficios, pasos y preguntas no lleva cifras (salvo la garantía)', () => {
    const copy = [
      ...BENEFICIOS.map((b) => `${b.titulo} ${b.texto}`),
      ...PASOS_VENTA.map((p) => `${p.titulo} ${p.texto}`),
      ...PREGUNTAS.filter((q) => !q.respuesta.includes('garantía')).map((q) => `${q.pregunta} ${q.respuesta}`),
    ];
    for (const linea of copy) expect(linea).not.toMatch(/\d/);
  });
});

describe('onboarding', () => {
  it('tiene tres pasos con los títulos acordados', () => {
    expect(PASOS_BIENVENIDA.map((p) => p.titulo)).toEqual(['Tu viaje', 'Tus días', 'Tus reservas y pendientes']);
  });

  it('el primer paso muestra Saltar hacia el acceso y no usa palabras prohibidas', () => {
    const html = marcar(renderToStaticMarkup(createElement(Bienvenida)));
    expect(html).toContain('href="#/acceso"');
    expect(texto(html)).toContain('Paso 1 de 3');
    expect(texto(html)).toContain('Saltar');
    expect(texto(html)).not.toMatch(/\b(ejemplos?|ficticio|de muestra)\b/i);
  });

  it('anuncia la prueba de 7 días con el mismo valor que la portada', () => {
    const html = marcar(renderToStaticMarkup(createElement(Bienvenida)));
    expect(texto(html)).toContain(`Empieza con prueba de ${plantilla.pruebaDias} días.`);
    expect(texto(html)).not.toMatch(/sin prueba|cero días|14 días|21 días/i);
  });
});

describe('sin control de acceso (ACCESS_CODE vacío)', () => {
  it('«Ya tengo acceso» y el final del onboarding van al itinerario; con acceso, siguen yendo a #/acceso', () => {
    expect(destinoAcceso(false)).toBe('#/itinerario');
    expect(destinoAcceso(true)).toBe('#/acceso');
    expect(destinoFinalOnboarding(false)).toEqual({ texto: 'Ir al itinerario', href: '#/itinerario' });
    expect(destinoFinalOnboarding(true)).toEqual({ texto: 'Ir al acceso', href: '#/acceso' });
  });

  it('la portada se ve en #/ también sin control de acceso', () => {
    const abierta = { status: 'ready' as const, ruta: 'venta' as const, authRequired: false, authChecked: true };
    expect(elegirVista(abierta)).toBe('venta');
    expect(elegirVista({ ...abierta, ruta: 'empezar' })).toBe('bienvenida');
  });

  it('con control de acceso, la portada solo se ve sin sesión; con sesión, va a la app', () => {
    expect(elegirVista({ status: 'locked', ruta: 'venta', authRequired: true, authChecked: true })).toBe('venta');
    expect(elegirVista({ status: 'ready', ruta: 'venta', authRequired: true, authChecked: true })).toBe('app');
  });

  it('mientras no se sabe si hay control de acceso, un dispositivo con datos guardados ve la app y no la portada', () => {
    expect(elegirVista({ status: 'ready', ruta: 'venta', authRequired: false, authChecked: false })).toBe('app');
  });

  it('las demás rutas de la tabla de decisiones', () => {
    expect(elegirVista({ status: 'loading', ruta: 'venta', authRequired: false, authChecked: false })).toBe('cargando');
    expect(elegirVista({ status: 'error', ruta: 'venta', authRequired: false, authChecked: false })).toBe('error');
    expect(elegirVista({ status: 'locked', ruta: 'empezar', authRequired: true, authChecked: true })).toBe('bienvenida');
    expect(elegirVista({ status: 'locked', ruta: 'acceso', authRequired: true, authChecked: true })).toBe('acceso');
    expect(elegirVista({ status: 'locked', ruta: 'app', authRequired: true, authChecked: true })).toBe('acceso');
    expect(elegirVista({ status: 'ready', ruta: 'app', authRequired: false, authChecked: true })).toBe('app');
    expect(elegirVista({ status: 'ready', ruta: 'empezar', authRequired: true, authChecked: true })).toBe('app');
    expect(elegirVista({ status: 'ready', ruta: 'empezar', authRequired: false, authChecked: true })).toBe('bienvenida');
  });

  it('la portada sin control de acceso lleva «Ya tengo acceso» al itinerario y el onboarding a #/itinerario', () => {
    const html = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: null, conAcceso: false })));
    expect(html.match(/href="#\/itinerario"/g)).toHaveLength(3);
    expect(html).not.toContain('href="#/acceso"');
    const onboarding = marcar(renderToStaticMarkup(createElement(Bienvenida, { conAcceso: false })));
    expect(onboarding).toContain('href="#/itinerario"');
    expect(onboarding).not.toContain('href="#/acceso"');
  });
});

describe('firma y tarjeta de la portada', () => {
  it('los kilómetros son distancias reales entre las paradas', () => {
    const [a, b] = tramosFirma();
    expect(a.km).toBeGreaterThan(300);
    expect(a.km).toBeLessThan(340);
    expect(b.km).toBeGreaterThan(180);
    expect(b.km).toBeLessThan(240);
  });

  it('la tarjeta describe el mismo día y la misma actividad que el viaje de muestra', () => {
    const seed = buildSeed();
    const dia = seed.days[0];
    const plan = seed.activities.filter((a) => a.dayDate === dia.date && a.time === DATO_HERO.hora);
    expect(DATO_HERO.dia).toBe(`Día 1 · ${dia.title}`);
    expect(plan.map((a) => a.text)).toContain(DATO_HERO.linea);
  });
});

describe('precios sugeridos', () => {
  const { mensual, anual, moneda } = plantilla.precios;
  const centavos = (n: number) => Math.round(n * 100);

  it('van en USD, la moneda de la app, con precios terminados en .99 o .90', () => {
    expect(moneda).toBe('USD');
    expect([99, 90]).toContain(centavos(mensual) % 100);
    expect([99, 90]).toContain(centavos(anual) % 100);
  });

  it('el anual son 10 mensualidades, es decir, dos meses gratis', () => {
    expect(centavos(anual)).toBe(centavos(mensual) * 10);
  });

  it('la mensualidad está en el rango de consumo familiar o de bienestar (3,99 a 7,99 USD)', () => {
    expect(mensual).toBeGreaterThanOrEqual(3.99);
    expect(mensual).toBeLessThanOrEqual(7.99);
  });

  it('la portada muestra los dos planes con su precio, «Dos meses gratis» y la prueba de 7 días', () => {
    expect(precioTexto(mensual)).toBe('$4.99');
    expect(precioTexto(anual)).toBe('$49.90');
    const t = texto(renderToStaticMarkup(createElement(VentaContenido, { enlace: null })));
    expect(t).toContain(`${precioTexto(mensual)} al mes`);
    expect(t).toContain(`${precioTexto(anual)} al año`);
    expect(t).toContain('Dos meses gratis');
    expect(plantilla.pruebaDias).toBe(7);
    expect(t).toContain('Ambos incluyen las mismas funciones y una prueba de 7 días.');
    expect(t).not.toMatch(/sin prueba|cero días|14 días|21 días/i);
  });

  it('el aviso de demostración se marca para la captura y solo aparece sin enlace de compra', () => {
    const sinEnlace = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: null })));
    expect(sinEnlace.match(/data-captura="oculto"/g)).toHaveLength(1);
    expect(sinEnlace).toMatch(/<p[^>]*data-captura="oculto"[^>]*>Demostración: no se cobra nada\.<\/p>/);
    const conEnlace = marcar(renderToStaticMarkup(createElement(VentaContenido, { enlace: CON_ENLACE })));
    expect(conEnlace).not.toContain('data-captura');
  });
});
