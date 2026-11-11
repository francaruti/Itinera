import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import { cityMeta } from '../../../../shared/constants';
import { PHOTOS, photoUrl } from '../../lib/photos';
import { useStore } from '../../store';

/** Visor a pantalla completa con crédito y enlace a la fuente. */
export default function Lightbox() {
  const key = useStore((s) => s.lightbox);
  const close = useStore((s) => s.openPhoto);
  const p = key ? PHOTOS[key] : null;

  useEffect(() => {
    if (!key) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [key, close]);

  return (
    <AnimatePresence>
      {p && (
        <motion.div
          className="lightbox overlay"
          role="dialog"
          aria-modal="true"
          aria-label={p.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => close(null)}
        >
          <motion.figure
            className="lightbox-fig"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={photoUrl(p, 1920)} alt={p.name} crossOrigin="anonymous" referrerPolicy="no-referrer" />
            <figcaption>
              <div>
                <strong className="h-stretch">{p.name}</strong>
                <small>
                  {cityMeta(p.city).name} · Foto: {p.author} ·{' '}
                  <a href={p.licenseUrl || p.page} target="_blank" rel="noreferrer">
                    {p.license}
                  </a>
                </small>
              </div>
              <a className="btn ghost sm" href={p.page} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Wikimedia Commons
              </a>
            </figcaption>
          </motion.figure>
          <button className="lightbox-close icon-btn" onClick={() => close(null)} aria-label="Cerrar foto" data-autofocus>
            <X size={22} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
