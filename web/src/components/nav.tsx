import { CalendarDays, CloudSun, Info, ListChecks, Map as MapIcon, Ticket, Wallet, type LucideIcon } from 'lucide-react';
import type { TabId } from '../store';

export const TAB_META: Record<TabId, { label: string; short: string; icon: LucideIcon }> = {
  itinerario: { short: 'Plan', label: 'Itinerario', icon: CalendarDays },
  mapa: { short: 'Mapa', label: 'Mapa', icon: MapIcon },
  clima: { short: 'Clima', label: 'Clima', icon: CloudSun },
  reservas: { short: 'Reservas', label: 'Reservas', icon: Ticket },
  pendientes: { short: 'Listas', label: 'Pendientes', icon: ListChecks },
  presupuesto: { short: 'Gastos', label: 'Presupuesto', icon: Wallet },
  info: { short: 'Info', label: 'Info', icon: Info },
};
