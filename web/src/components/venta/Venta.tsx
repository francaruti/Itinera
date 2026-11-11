import { CalendarDays, ShieldCheck, Ticket, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_NAME } from '../../../../shared/constants';
import { plantilla } from '../../../../shared/plantilla';
import { BENEFICIOS, PASOS_VENTA, PREGUNTAS, SUBTITULO, TITULAR, destinoAcceso, enlaceCompra, precioTexto } from '../../lib/ventas';
import { Ambient } from '../Ambient';
import { Logo } from '../Logo';
import { HeroFirma } from './HeroFirma';

const ICONOS_BENEFICIO = [CalendarDays, Ticket, Wallet];

/** Tres grupos de CTA con la misma acción: arriba, a mitad y al final. Cada uno lleva su garantía cerca. */
function Acciones({ zona, enlace, conAcceso }: { zona: 'arriba' | 'medio' | 'final'; enlace: string | null; conAcceso: boolean }) {
  return (
    <div className="venta-acciones">
      <div className="venta-ctas">
        <a id={`cta-empezar-${zona}`} className="btn accent venta-cta" href="#/empezar" data-evento="inicio-compra">
          Empezar mi viaje
        </a>
        <a id={`cta-acceso-${zona}`} className="btn ghost venta-cta" href={destinoAcceso(conAcceso)} data-evento="acceso-existente">
          Ya tengo acceso
        </a>
      </div>
      <p className="venta-garantia">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          <strong>Garantía de {plantilla.garantiaDias} días</strong>
          {enlace ? '. Si compras por Hotmart, la solicitud dentro de ese plazo la tramita Hotmart.' : ''}
        </span>
      </p>
    </div>
  );
}

/** Espera a las fuentes de la marca antes de pintar la portada: así el texto no se reacomoda después (CLS 0). */
function useFuentesListas(): boolean {
  const [listas, setListas] = useState(false);
  useEffect(() => {
    const fuentes = typeof document !== 'undefined' && 'fonts' in document ? document.fonts : null;
    if (!fuentes) {
      setListas(true);
      return;
    }
    let vivo = true;
    Promise.all([fuentes.load('400 16px "Archivo Variable"'), fuentes.load('700 40px "Montserrat Variable"')])
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setListas(true);
      });
    return () => {
      vivo = false;
    };
  }, []);
  return listas;
}

/** Portada pública: se muestra sin sesión en la ruta principal (#/). */
export function Venta({
  enlace = enlaceCompra(),
  enlaceAnual = enlaceCompra(plantilla.enlaceCompraAnual),
  conAcceso = true,
}: {
  enlace?: string | null;
  enlaceAnual?: string | null;
  conAcceso?: boolean;
}) {
  const listas = useFuentesListas();
  if (!listas) return <div className="venta" aria-busy="true" aria-label="Cargando" />;
  return <VentaContenido enlace={enlace} enlaceAnual={enlaceAnual} conAcceso={conAcceso} />;
}

/** Contenido de la portada sin esperar a las fuentes (para pruebas de marcado). */
export function VentaContenido({
  enlace = enlaceCompra(),
  enlaceAnual = null,
  conAcceso = true,
}: {
  enlace?: string | null;
  enlaceAnual?: string | null;
  conAcceso?: boolean;
}) {
  return (
    <div className="venta">
      <Ambient />
      <header className="venta-top">
        <div className="container venta-top-in">
          <a className="venta-marca" href="#/" aria-label={`${APP_NAME}, inicio`}>
            <Logo size={34} />
            <strong>{APP_NAME}</strong>
          </a>
        </div>
      </header>

      <main className="venta-main">
        <section className="container venta-hero" aria-labelledby="venta-titulo">
          <div className="venta-copy">
            <h1 id="venta-titulo" className="venta-titulo">
              {TITULAR}
            </h1>
            <p className="venta-sub">{SUBTITULO}</p>
            <Acciones zona="arriba" enlace={enlace} conAcceso={conAcceso} />
          </div>
          <HeroFirma />
        </section>

        <section className="container venta-seccion venta-banda" aria-labelledby="venta-beneficios">
          <h2 id="venta-beneficios" className="venta-h2">
            Lo que resuelve la app
          </h2>
          <ul className="venta-tarjetas">
            {BENEFICIOS.map((b, i) => {
              const Icono = ICONOS_BENEFICIO[i];
              return (
                <li key={b.titulo} className="venta-tarjeta">
                  <span className="venta-ico" aria-hidden="true">
                    <Icono size={22} />
                  </span>
                  <h3>{b.titulo}</h3>
                  <p>{b.texto}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="container venta-seccion" aria-labelledby="venta-pasos">
          <h2 id="venta-pasos" className="venta-h2">
            Cómo funciona en tres pasos
          </h2>
          <ol className="venta-pasos">
            {PASOS_VENTA.map((p) => (
              <li key={p.titulo} className="venta-paso-item">
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
          <Acciones zona="medio" enlace={enlace} conAcceso={conAcceso} />
        </section>

        <section className="container venta-seccion venta-banda" aria-labelledby="venta-planes">
          <h2 id="venta-planes" className="venta-h2">
            Elige tu plan
          </h2>
          <ul className="venta-planes">
            <li className="venta-plan">
              <h3>Mensual</h3>
              <p className="venta-precio">
                <strong>{precioTexto(plantilla.precios.mensual)}</strong>
                <span> al mes, IVA incluido</span>
              </p>
              {enlace ? (
                <a className="btn accent venta-cta venta-comprar" href={enlace} data-evento="elegir-plan-mensual">
                  Comprar plan mensual
                </a>
              ) : null}
            </li>
            <li className="venta-plan venta-plan-destacado">
              <h3>Anual</h3>
              <p className="venta-precio">
                <strong>{precioTexto(plantilla.precios.anual)}</strong>
                <span> al año, IVA incluido</span>
              </p>
              <p className="venta-plan-nota">Dos meses gratis</p>
              {enlaceAnual ? (
                <a className="btn accent venta-cta venta-comprar" href={enlaceAnual} data-evento="elegir-plan-anual">
                  Comprar plan anual
                </a>
              ) : null}
            </li>
          </ul>
          <p className="venta-prueba">Ambos incluyen las mismas funciones y una prueba de {plantilla.pruebaDias} días.</p>
          <p className="venta-prueba">
            Cómo funciona la prueba: empiezas con {plantilla.pruebaDias} días sin costo. Al terminar, se cobra el plan que elijas:{' '}
            {precioTexto(plantilla.precios.mensual)} al mes o {precioTexto(plantilla.precios.anual)} al año, con IVA incluido. Se cobra en pesos chilenos (CLP) a través de Hotmart. Si cancelas antes de que
            termine la prueba, no se te cobra nada. Puedes cancelar cuando quieras; la cancelación se tramita con Hotmart.
          </p>
        </section>

        <section className="container venta-seccion" aria-labelledby="venta-faq">
          <h2 id="venta-faq" className="venta-h2">
            Preguntas frecuentes
          </h2>
          <div className="venta-faq">
            {PREGUNTAS.map((q) => (
              <details key={q.pregunta} className="venta-faq-item">
                <summary>{q.pregunta}</summary>
                <p>{q.respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container venta-seccion venta-cierre" aria-labelledby="venta-cierre">
          <h2 id="venta-cierre" className="venta-h2">
            Tu próximo viaje, con todo a la vista
          </h2>
          <Acciones zona="final" enlace={enlace} conAcceso={conAcceso} />
          {enlace || enlaceAnual ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {enlace ? (
                <a id="cta-comprar" className="btn ghost venta-cta venta-comprar" href={enlace} data-evento="inicio-compra">
                  Comprar plan mensual
                </a>
              ) : null}
              {enlaceAnual ? (
                <a id="cta-comprar-anual" className="btn ghost venta-cta venta-comprar" href={enlaceAnual} data-evento="inicio-compra">
                  Comprar plan anual
                </a>
              ) : null}
            </div>
          ) : (
            <p className="venta-demo" role="note" data-captura="oculto">
              Demostración: no se cobra nada.
            </p>
          )}
        </section>
      </main>

      <footer className="venta-pie">
        <div className="container venta-pie-in">
          <p>
            © {plantilla.anioCopyright} {APP_NAME}
          </p>
          <nav aria-label="Legal">
            <a href="#/legal/privacidad">Privacidad</a>
            <a href="#/legal/terminos">Términos</a>
            <a href={`mailto:${plantilla.contactoEmail}`}>Contacto</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
