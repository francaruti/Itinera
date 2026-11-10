import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose(): void;
  title?: string;
  wide?: boolean;
  /** Posiciona el diálogo arriba (paleta de búsqueda). */
  top?: boolean;
  hideHeader?: boolean;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, wide, top, hideHeader, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  // `onClose` suele ser una función nueva en cada render: si el efecto dependiera de ella, al escribir en un campo
  // (cada tecla actualiza el estado) se «reabriría» la hoja, devolviendo el foco al botón de origen y cerrando el teclado.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      // En pantallas táctiles no se enfoca ningún campo (abriría el teclado y taparía la hoja).
      const fine = window.matchMedia('(pointer: fine)').matches;
      const el = ref.current?.querySelector<HTMLElement>(fine ? '[data-autofocus], input:not([type=hidden]), textarea, select' : '[data-autofocus]');
      el?.focus({ preventScroll: true });
    }, 60);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Portal al <body>: un ancestro con backdrop-filter/transform recortaría un overlay `fixed`.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`overlay${top ? ' top' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`sheet${wide ? ' wide' : ''}`}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {!hideHeader && (
              <div className="sheet-head">
                <h2 id={titleId} className="h-stretch">
                  {title}
                </h2>
                <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
