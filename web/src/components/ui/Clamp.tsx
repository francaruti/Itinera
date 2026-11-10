import { useLayoutEffect, useRef, useState, type ElementType, type MouseEvent } from 'react';

interface Props {
  children: string;
  /** Líneas visibles antes del «…» (1 o 2). */
  lines?: 1 | 2;
  as?: ElementType;
  className?: string;
}

/**
 * Texto de lectura que nunca pasa de 1–2 líneas: si no cabe se corta con «…» y un toque
 * (en el texto o en «Ver más») lo expande; otro toque lo vuelve a recoger.
 * Solo muestra el control cuando de verdad hay texto oculto.
 */
export function Clamp({ children, lines = 2, as: Tag = 'p', className = '' }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!open) setCut(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, open, lines]);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };
  const interactive = cut || open;

  return (
    <div className="clamp">
      <Tag
        ref={ref}
        className={`clamp-text ${className}${open ? ' open' : ''}${interactive ? ' can' : ''}`}
        style={{ ['--lines' as string]: lines }}
        onClick={interactive ? toggle : undefined}
      >
        {children}
      </Tag>
      {interactive && (
        <button type="button" className="clamp-more" aria-expanded={open} onClick={toggle}>
          {open ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
