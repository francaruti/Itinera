import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface Slide {
  key: string;
  node: ReactNode;
}

interface Props {
  slides: Slide[];
  initialKey?: string;
  onActive?(index: number, key: string): void;
  /** Se muestra un solo `render` por tarjeta con su estado «activa» */
  label: string;
}

/**
 * Carrusel de una tarjeta por pantalla: arrastre con el dedo (o flechas), la tarjeta del centro se agranda
 * y las vecinas se asoman. Solo se actualizan variables CSS mientras se desliza (sin re-renderizar las tarjetas).
 */
export function WalletCarousel({ slides, initialKey, onActive, label }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => Math.max(0, slides.findIndex((s) => s.key === initialKey)));
  const raf = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  const update = useCallback(() => {
    raf.current = 0;
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i] as HTMLElement;
      const c = k.offsetLeft + k.offsetWidth / 2;
      const d = Math.abs(c - mid);
      k.style.setProperty('--d', String(Math.min(1, d / k.offsetWidth)));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== activeRef.current) {
      setActive(best);
      onActive?.(best, slides[best]?.key ?? '');
    }
  }, [onActive, slides]);

  const go = useCallback((i: number, smooth = true) => {
    const el = track.current;
    const k = el?.children[Math.max(0, Math.min((el?.children.length ?? 1) - 1, i))] as HTMLElement | undefined;
    if (!el || !k) return;
    el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  }, []);

  // Al abrir: la tarjeta pedida queda centrada, sin animación
  useLayoutEffect(() => {
    go(Math.max(0, slides.findIndex((s) => s.key === initialKey)), false);
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [update]);

  const n = slides.length;
  return (
    <div className="wzc" role="region" aria-roledescription="carrusel" aria-label={label}>
      <div
        ref={track}
        className="wzc-track"
        tabIndex={0}
        onScroll={() => {
          if (!raf.current) raf.current = requestAnimationFrame(update);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'ArrowRight') (e.preventDefault(), go(active + 1));
          else if (e.key === 'ArrowLeft') (e.preventDefault(), go(active - 1));
        }}
      >
        {slides.map((s, i) => (
          <div key={s.key} className={`wzc-slide${i === active ? ' on' : ''}`} style={{ ['--i' as string]: i }} onClick={i !== active ? () => go(i) : undefined}>
            {/* Las tarjetas vecinas no se pueden tocar por dentro: un toque las trae al centro */}
            <div className="wzc-inner" aria-hidden={i !== active} inert={i !== active ? true : undefined}>
              {s.node}
            </div>
          </div>
        ))}
      </div>

      {n > 1 && (
        <div className="wzc-pager">
          <button type="button" className="wzc-arrow" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Tarjeta anterior">
            <ChevronLeft size={20} />
          </button>
          <div className="wzc-dots" role="tablist" aria-label="Tarjetas">
            {n <= 10 ? (
              slides.map((s, i) => <button key={s.key} type="button" role="tab" aria-selected={i === active} aria-label={`Tarjeta ${i + 1} de ${n}`} className={i === active ? 'on' : ''} onClick={() => go(i)} />)
            ) : (
              <span className="wzc-count">
                {active + 1} / {n}
              </span>
            )}
          </div>
          <button type="button" className="wzc-arrow" onClick={() => go(active + 1)} disabled={active === n - 1} aria-label="Tarjeta siguiente">
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
