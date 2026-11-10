import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tap } from '../lib/haptics';
import { useStore } from '../store';

const THRESHOLD = 78;

/** Tirar hacia abajo desde el inicio de la página para sincronizar (solo pantallas táctiles). */
export function PullToRefresh() {
  const refresh = useStore((s) => s.refresh);
  const loadWeather = useStore((s) => s.loadWeather);
  const toast = useStore((s) => s.toast);
  const pull = useMotionValue(0);
  const opacity = useTransform(pull, [0, 24, THRESHOLD], [0, 0.6, 1]);
  const rotate = useTransform(pull, [0, THRESHOLD * 1.6], [0, 300]);
  const y = useTransform(pull, (v) => Math.min(v, THRESHOLD * 1.3) - 44);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const blocked = (e.target as HTMLElement).closest('input, textarea, select, .overlay, .leaflet-container, .gallery-track, .route, .grip');
      start.current = window.scrollY <= 0 && !blocked ? { x: t.clientX, y: t.clientY } : null;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current || busy) return;
      const t = e.touches[0];
      const dy = t.clientY - start.current.y;
      const dx = Math.abs(t.clientX - start.current.x);
      if (dy > 8 && dy > dx * 1.5 && window.scrollY <= 0) {
        pull.set(dy * 0.55);
        if (!armed.current && dy * 0.55 >= THRESHOLD) {
          armed.current = true;
          tap(12);
        }
      } else if (dy <= 0) pull.set(0);
    };
    const onEnd = async () => {
      if (!start.current) return;
      start.current = null;
      if (pull.get() >= THRESHOLD && !busy) {
        setBusy(true);
        pull.set(THRESHOLD);
        await Promise.all([refresh(), loadWeather()]);
        toast('Actualizado', 'success');
        setBusy(false);
      }
      pull.set(0);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [busy, loadWeather, pull, refresh, toast]);

  return (
    <motion.div className="ptr" style={{ y, opacity }} aria-hidden="true">
      <motion.span style={{ rotate: busy ? undefined : rotate }} className={busy ? 'spin' : ''}>
        <RefreshCw size={18} />
      </motion.span>
    </motion.div>
  );
}
