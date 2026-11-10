import { AnimatePresence, motion } from 'framer-motion';
import { Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInstall } from '../lib/install';

const KEY = 'viaje:install-dismissed';
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Invita una sola vez (en el celular) a instalar la app; en iPhone explica el paso manual de Safari. */
export function InstallNudge() {
  const install = useInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === '1';
    } catch {
      /* sin almacenamiento */
    }
    const mobile = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900;
    if (dismissed || !mobile || install.state === 'installed') return;
    const t = setTimeout(() => setShow(true), 12_000);
    return () => clearTimeout(t);
  }, [install.state]);

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  };
  const ios = isIos();
  if (install.state === 'none' && !ios) return null;

  return (
    <AnimatePresence>
      {show && install.state !== 'installed' && (
        <motion.aside
          className="nudge"
          role="complementary"
          aria-label="Instalar la app"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <span className="nudge-icon">
            <Smartphone size={20} />
          </span>
          <div className="grow">
            <strong>Llévala en tu pantalla de inicio</strong>
            {ios ? (
              <small>
                Toca <Share size={13} style={{ verticalAlign: '-2px' }} /> y luego «Añadir a pantalla de inicio». Así abre más rápido y, si abriste el viaje con conexión antes, el itinerario se ve sin red.
              </small>
            ) : (
              <small>Se abre como una app. Si abriste el viaje con conexión antes, el itinerario se ve sin red.</small>
            )}
          </div>
          {!ios && (
            <button
              className="btn yellow sm"
              onClick={async () => {
                await install.install();
                close();
              }}
            >
              Instalar
            </button>
          )}
          <button className="icon-btn sm" onClick={close} aria-label="Cerrar">
            <X size={16} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
