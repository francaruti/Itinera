import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Ambient } from './components/Ambient';
import { ErrorScreen, Loading } from './components/BootScreens';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNav, Header } from './components/Header';
import { ImminentPopup } from './components/ImminentPopup';
import { InstallNudge } from './components/InstallNudge';
import { DocsSheet } from './components/reservations/DocsSheet';
import { SheetBoundary } from './components/ui/SheetBoundary';
import { TAB_META } from './components/nav';
import { PullToRefresh } from './components/PullToRefresh';
import { LockScreen } from './components/LockScreen';
import { Bienvenida } from './components/venta/Bienvenida';
import { Venta } from './components/venta/Venta';
import { LegalPage, legalFromHash, type LegalKind } from './components/LegalPage';
import { elegirVista, pantallaDesdeHash } from './lib/ventas';
import { Toasts } from './components/ui/Toasts';
import { useHotkey } from './hooks/useHotkey';
import { APP_NAME } from '../../shared/constants';
import { plantilla } from '../../shared/plantilla';
import { tabFromHash, useStore, type TabId } from './store';

const LEGAL_TITULO: Record<LegalKind, string> = { privacidad: 'Privacidad', terminos: 'Términos de uso' };
const LEGAL_DESCRIPCION: Record<LegalKind, string> = {
  privacidad: `Cómo ${APP_NAME} guarda y usa tus datos.`,
  terminos: `Condiciones de uso de ${APP_NAME}.`,
};

const ItineraryView = lazy(() => import('./views/ItineraryView'));
const MapView = lazy(() => import('./views/MapView'));
const WeatherView = lazy(() => import('./views/WeatherView'));
const ReservationsView = lazy(() => import('./views/ReservationsView'));
const ChecklistView = lazy(() => import('./views/ChecklistView'));
const BudgetView = lazy(() => import('./views/BudgetView'));
const InfoView = lazy(() => import('./views/InfoView'));
const SearchPalette = lazy(() => import('./components/SearchPalette'));
const SettingsSheet = lazy(() => import('./components/SettingsSheet'));
const PrintView = lazy(() => import('./components/PrintView'));
const Lightbox = lazy(() => import('./components/photos/Lightbox'));
const AddPlaceSheet = lazy(() => import('./components/itinerary/AddPlaceSheet'));
const DaySheet = lazy(() => import('./components/itinerary/DaySheet'));

const VIEWS: Record<TabId, React.LazyExoticComponent<() => React.ReactElement>> = {
  itinerario: ItineraryView,
  mapa: MapView,
  clima: WeatherView,
  reservas: ReservationsView,
  pendientes: ChecklistView,
  presupuesto: BudgetView,
  info: InfoView,
};

export default function App() {
  const status = useStore((s) => s.status);
  const tab = useStore((s) => s.tab);
  const init = useStore((s) => s.init);
  const searchOpen = useStore((s) => s.searchOpen);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);

  // Páginas legales (#/legal/…): públicas, también antes de entrar.
  const [legal, setLegal] = useState(() => legalFromHash(window.location.hash));
  // Sin sesión: portada (#/), onboarding (#/empezar) o acceso (#/acceso).
  const [ruta, setRuta] = useState(() => pantallaDesdeHash(window.location.hash));
  const authRequired = useStore((s) => s.authRequired);
  const authChecked = useStore((s) => s.authChecked);
  const vista = elegirVista({ status, ruta, authRequired, authChecked });

  useEffect(() => {
    void init();
    const onHash = () => {
      useStore.setState({ tab: tabFromHash() });
      setLegal(legalFromHash(window.location.hash));
      setRuta(pantallaDesdeHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, [init]);

  // Si aparece una ciudad o fecha sin pronóstico (p. ej. un día nuevo), se vuelve a pedir el clima.
  const weather = useStore((s) => s.weather);
  const snap = useStore((s) => s.snap);
  const loadWeather = useStore((s) => s.loadWeather);
  const weatherKey = useRef('');
  useEffect(() => {
    if (!snap || status !== 'ready') return;
    const need = snap.days.filter((d) => !weather?.cities[d.city]?.some((w) => w.date === d.date) && !weather?.hourly?.[d.city]?.[d.date]);
    const key = need.map((d) => `${d.city}:${d.date}`).join(',');
    if (key && key !== weatherKey.current) {
      weatherKey.current = key;
      const t = setTimeout(() => void loadWeather(true), 1200);
      return () => clearTimeout(t);
    }
  }, [snap, weather, status, loadWeather]);

  // Con sesión, la portada y el onboarding llevan a la app. Sin control de acceso, la portada se queda
  // y #/acceso va directo al itinerario.
  useEffect(() => {
    const llevaAlItinerario = ruta === 'acceso' || ((ruta === 'venta' || ruta === 'empezar') && authRequired);
    if (status === 'ready' && llevaAlItinerario) {
      history.replaceState(null, '', '#/itinerario');
      setRuta('app');
    }
  }, [status, ruta, authRequired]);

  // Título y descripción por página: acceso, páginas legales y cada sección.
  useEffect(() => {
    document.title = legal
      ? `${LEGAL_TITULO[legal]} · ${APP_NAME}`
      : vista !== 'app'
        ? `${APP_NAME} · ${plantilla.eslogan}`
        : `${TAB_META[tab].label} · ${APP_NAME}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', legal ? LEGAL_DESCRIPCION[legal] : plantilla.descripcion);
  }, [tab, legal, vista]);

  useHotkey(
    (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k',
    (e) => {
      e.preventDefault();
      setSearchOpen(true);
    },
    { allowTyping: true },
  );
  useHotkey(
    (e) => e.key === '/' && !e.metaKey && !e.ctrlKey,
    (e) => {
      e.preventDefault();
      setSearchOpen(true);
    },
  );

  // Los diálogos se montan al abrirse por primera vez y se quedan para animar su cierre.
  const addPlaceOpen = useStore((s) => !!s.addPlace);
  const daySheetOpen = useStore((s) => !!s.daySheet);
  const seen = useRef({ search: false, settings: false, addPlace: false, daySheet: false });
  if (addPlaceOpen) seen.current.addPlace = true;
  if (daySheetOpen) seen.current.daySheet = true;
  if (searchOpen) seen.current.search = true;
  if (settingsOpen) seen.current.settings = true;

  if (legal) return <LegalPage kind={legal} />;
  if (vista === 'error') return <ErrorScreen />;
  if (vista === 'cargando') return <Loading />;
  if (vista === 'venta') return <Venta conAcceso={authRequired} />;
  if (vista === 'bienvenida') return <Bienvenida conAcceso={authRequired} />;
  if (vista === 'acceso') return <LockScreen />;

  const View = VIEWS[tab];
  return (
    <>
      <Ambient />
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Header />
      <main className="main" id="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ErrorBoundary resetKey={tab}>
              <Suspense fallback={<Loading />}>
                <View />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
      <PullToRefresh />
      <InstallNudge />
      <Toasts />
      <Suspense fallback={null}>
        {seen.current.search && <SearchPalette />}
        {seen.current.settings && <SettingsSheet />}
        <PrintView />
        <Lightbox />
        {seen.current.addPlace && <AddPlaceSheet />}
        {seen.current.daySheet && <DaySheet />}
      </Suspense>
      {/* Hojas del inicio: siempre cargadas (sin descargas diferidas que puedan fallar) y aisladas de errores */}
      <SheetBoundary>
        <DocsSheet />
        <ImminentPopup />
      </SheetBoundary>
    </>
  );
}
