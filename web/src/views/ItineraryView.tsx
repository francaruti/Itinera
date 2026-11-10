import { WifiOff } from 'lucide-react';
import { ChecklistPreview, DayReservations, Facts } from '../components/itinerary/Aside';
import { DayView } from '../components/itinerary/DayView';
import { RouteStrip } from '../components/itinerary/RouteStrip';
import { Hero } from '../components/Hero';
import { QuickAccess } from '../components/QuickAccess';
import { PlacesGallery } from '../components/photos/PlacesGallery';
import { useHotkey } from '../hooks/useHotkey';
import { useStore } from '../store';

export default function ItineraryView() {
  const snap = useStore((s) => s.snap)!;
  const date = useStore((s) => s.selectedDate);
  const selectDate = useStore((s) => s.selectDate);
  const online = useStore((s) => s.online);
  const day = snap.days.find((d) => d.date === date) ?? snap.days[0];

  const step = (n: number) => {
    const i = snap.days.findIndex((d) => d.date === date);
    const target = snap.days[i + n];
    if (target) selectDate(target.date);
  };
  const noModal = () => !document.querySelector('.overlay');
  useHotkey((e) => e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey && !e.altKey && noModal(), () => step(-1));
  useHotkey((e) => e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey && !e.altKey && noModal(), () => step(1));

  return (
    <div className="container">
      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff size={16} /> Estás sin conexión. Puedes seguir editando: los cambios se enviarán al volver internet.
        </div>
      )}
      <QuickAccess snap={snap} />
      <Hero snap={snap} />
      <RouteStrip snap={snap} />
      <div className="it-grid">
        <DayView snap={snap} />
        <aside className="aside">
          <DayReservations snap={snap} date={date} />
          <ChecklistPreview snap={snap} />
          <Facts city={day.city} />
        </aside>
      </div>
      <PlacesGallery snap={snap} />
    </div>
  );
}
