import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarDays, ListChecks, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { plantilla } from '../../../../shared/plantilla';
import { PASOS_BIENVENIDA, destinoAcceso, destinoFinalOnboarding } from '../../lib/ventas';
import { Ambient } from '../Ambient';
import { Logo } from '../Logo';

const ICONOS = [MapPin, CalendarDays, ListChecks];

/**
 * Onboarding de tres pasos para quien entra por primera vez. «Saltar» y el último paso llevan al acceso
 * (#/acceso) o, sin control de acceso, directo al itinerario (#/itinerario).
 */
export function Bienvenida({ conAcceso = true }: { conAcceso?: boolean }) {
  const [paso, setPaso] = useState(0);
  const final = destinoFinalOnboarding(conAcceso);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primera = useRef(true);
  const total = PASOS_BIENVENIDA.length;
  const actual = PASOS_BIENVENIDA[paso];
  const Icono = ICONOS[paso];

  // Al cambiar de paso, el foco va al título para que el lector de pantalla anuncie el nuevo paso.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    titulo.current?.focus();
  }, [paso]);

  return (
    <div className="venta venta-bienvenida">
      <Ambient />
      <header className="venta-top">
        <div className="container venta-top-in">
          <span className="venta-marca">
            <Logo size={34} />
          </span>
          <a className="btn ghost sm venta-saltar" href={destinoAcceso(conAcceso)}>
            Saltar
          </a>
        </div>
      </header>

      <main className="container venta-bienvenida-main">
        <p className="venta-paso-cuenta" aria-live="polite">
          Paso {paso + 1} de {total}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={actual.id}
            className="card venta-paso-card"
            aria-labelledby="venta-paso-titulo"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="venta-ico venta-ico-grande" aria-hidden="true">
              <Icono size={26} />
            </span>
            <h1 id="venta-paso-titulo" ref={titulo} tabIndex={-1}>
              {actual.titulo}
            </h1>
            <p className="venta-paso-texto">{actual.texto}</p>
            <ul className="venta-chips" aria-label="Lo que incluye este paso">
              {actual.muestra.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </motion.section>
        </AnimatePresence>

        <p className="venta-prueba">Empieza con prueba de {plantilla.pruebaDias} días.</p>

        <div className="venta-paso-nav">
          <button type="button" className="btn ghost" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>
            <ArrowLeft size={18} aria-hidden="true" /> Atrás
          </button>
          {paso < total - 1 ? (
            <button type="button" className="btn accent" onClick={() => setPaso((p) => Math.min(total - 1, p + 1))}>
              Siguiente <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <a className="btn accent" href={final.href} id="bienvenida-acceso">
              {final.texto} <ArrowRight size={18} aria-hidden="true" />
            </a>
          )}
        </div>

        <ol className="venta-puntos" aria-hidden="true">
          {PASOS_BIENVENIDA.map((p, i) => (
            <li key={p.id} className={i === paso ? 'activo' : undefined} />
          ))}
        </ol>
      </main>
    </div>
  );
}
