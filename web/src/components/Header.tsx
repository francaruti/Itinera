import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Check, CloudOff, Loader2, MoreHorizontal, Search, Settings } from 'lucide-react';
import { APP_NAME } from '../../../shared/constants';
import { rangoCorto } from '../../../shared/time';
import { TABS, useStore, type TabId } from '../store';
import { Logo } from './Logo';
import { TAB_META } from './nav';

function SyncPill() {
  const online = useStore((s) => s.online);
  const syncing = useStore((s) => s.syncing);
  const pending = useStore((s) => s.pending);
  let icon = <Check size={15} />;
  let text = 'Sincronizado';
  let cls = 'ok';
  if (!online) {
    icon = <CloudOff size={15} />;
    text = pending ? `Sin conexión · ${pending} por enviar` : 'Sin conexión';
    cls = 'warn';
  } else if (syncing || pending > 0) {
    icon = <Loader2 size={15} className="spin" />;
    text = 'Guardando…';
    cls = 'busy';
  }
  return (
    <span className={`sync-pill ${cls}`} role="status" title={text}>
      {icon}
      <span className="sync-text">{text}</span>
    </span>
  );
}

export function Header() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const trip = useStore((s) => s.snap?.trip);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 6));
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const [masAbierto, setMasAbierto] = useState(false);
  const masRef = useRef<HTMLDivElement>(null);
  const masActivo = MAS_TABS.includes(tab);

  // El menú «Más» de escritorio se cierra al elegir sección, con Escape o al pulsar fuera.
  useEffect(() => setMasAbierto(false), [tab]);
  useEffect(() => {
    if (!masAbierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMasAbierto(false);
    const onDown = (e: PointerEvent) => {
      if (masRef.current && !masRef.current.contains(e.target as Node)) setMasAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [masAbierto]);

  return (
    <header className={`app-header${scrolled ? ' scrolled' : ''}`}>
      <div className="container header-inner">
        <button className="brand" onClick={() => setTab('itinerario')} title="Ir al itinerario">
          <Logo />
          <span className="brand-text">
            <strong className="h-stretch">{APP_NAME}</strong>
            <small>{trip ? rangoCorto(trip.startDate, trip.endDate) : ''}</small>
          </span>
        </button>

        {/* Cuatro controles como máximo: las tres secciones principales y «Más» para el resto. */}
        <nav className="tabs" aria-label="Secciones">
          {MAIN_TABS.map((id) => {
            const { label, icon: Icon } = TAB_META[id];
            const active = tab === id;
            return (
              <button key={id} className="tab" aria-current={active ? 'page' : undefined} aria-label={label} title={label} onClick={() => setTab(id)}>
                {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Icon size={17} />
                <span>{label}</span>
              </button>
            );
          })}
          <div className="tabs-mas" ref={masRef}>
            <button
              type="button"
              className="tab"
              aria-haspopup="menu"
              aria-expanded={masAbierto}
              aria-current={masActivo ? 'page' : undefined}
              aria-label={masActivo ? TAB_META[tab].label : 'Más secciones'}
              title={masActivo ? TAB_META[tab].label : 'Más secciones'}
              onClick={() => setMasAbierto((o) => !o)}
            >
              {masActivo && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <MoreHorizontal size={17} />
              {masActivo && <span>{TAB_META[tab].label}</span>}
            </button>
            {masAbierto && (
              <div className="tabs-mas-menu" role="menu" aria-label="Más secciones">
                {MAS_TABS.map((id) => {
                  const { label, icon: Icon } = TAB_META[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      className="tabs-mas-item"
                      aria-current={tab === id ? 'page' : undefined}
                      onClick={() => setTab(id)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="header-actions">
          <SyncPill />
          <button className="search-btn" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search size={17} />
            <span>Buscar</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <button className="icon-btn search-icon" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search size={20} />
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Ajustes">
            <Settings size={20} />
          </button>
        </div>
      </div>
      <motion.div className="scroll-progress" style={{ scaleX: progress }} aria-hidden="true" />
    </header>
  );
}

/** Pestañas fijas en la barra inferior; el resto vive en el menú «Más». Cámbialo aquí si prefieres otras. */
export const MAIN_TABS: TabId[] = ['itinerario', 'mapa', 'clima'];
/** El resto de secciones, que cuelgan de «Más» tanto en la cabecera como en la barra inferior. */
const MAS_TABS: TabId[] = TABS.filter((t) => !MAIN_TABS.includes(t));

export function BottomNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const [open, setOpen] = useState(false);
  const more = TABS.filter((t) => !MAIN_TABS.includes(t));
  const moreActive = more.includes(tab);

  // El menú se cierra con Escape y al cambiar de sección.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => setOpen(false), [tab]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="more-scrim" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} aria-hidden="true" />
            <motion.div
              className="more-menu"
              role="menu"
              aria-label="Más secciones"
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {more.map((id, i) => {
                const { label, icon: Icon } = TAB_META[id];
                const active = tab === id;
                return (
                  <motion.button
                    key={id}
                    role="menuitem"
                    className="more-item"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setTab(id)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.035 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span className="more-ico">
                      <Icon size={24} />
                    </span>
                    <span>{label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="bottom-nav" aria-label="Secciones">
        {MAIN_TABS.map((id) => {
          const { short, icon: Icon } = TAB_META[id];
          // Con el menú abierto, la selección visual pasa al botón «Más».
          const active = tab === id && !open;
          return (
            <button key={id} className="bn-item" aria-current={active ? 'page' : undefined} onClick={() => setTab(id)}>
              {active && <motion.span layoutId="bn-pill" className="bn-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={25} />
              <span>{short}</span>
            </button>
          );
        })}
        <button className="bn-item" aria-haspopup="menu" aria-expanded={open} data-active={moreActive || open ? 'true' : undefined} aria-current={moreActive ? 'page' : undefined} onClick={() => setOpen((o) => !o)}>
          {(moreActive || open) && <motion.span layoutId="bn-pill" className="bn-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <MoreHorizontal size={25} />
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}
