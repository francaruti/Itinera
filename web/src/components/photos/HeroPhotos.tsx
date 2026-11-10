import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PHOTOS } from '../../lib/photos';
import { Photo } from './Photo';

const SLIDES = Object.keys(PHOTOS);

/** Fondo del hero: fotos del viaje en fundido cruzado, enmascaradas hacia la derecha. */
export function HeroPhotos() {
  const [i, setI] = useState(0);
  useEffect(() => {
    // Sin pase de fotos si se pidió menos movimiento o en pantallas táctiles (cada cambio decodifica y funde una foto grande).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(hover: none)').matches) return;
    const id = setInterval(() => document.visibilityState === 'visible' && setI((n) => (n + 1) % SLIDES.length), 8000);
    return () => clearInterval(id);
  }, []);
  const p = PHOTOS[SLIDES[i]];
  if (!p) return null;
  return (
    <div className="hero-photos" aria-hidden="true">
      <AnimatePresence mode="sync">
        <motion.div
          key={p.key}
          className="hero-photo-slide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        >
          <Photo photo={p} width={1280} kenburns eager={i === 0} alt="" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
