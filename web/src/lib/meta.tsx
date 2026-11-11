import {
  BedDouble,
  Bus,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Coffee,
  Drama,
  FerrisWheel,
  Landmark,
  MoreHorizontal,
  ShoppingBag,
  Sun,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { cityMeta } from '../../../shared/constants';
import type { ActivityCategory, City } from '../../../shared/types';

export const CATEGORY_ICON: Record<ActivityCategory, LucideIcon> = {
  sight: Landmark,
  food: Utensils,
  transport: Bus,
  lodging: BedDouble,
  park: FerrisWheel,
  shopping: ShoppingBag,
  show: Drama,
  rest: Coffee,
  other: MoreHorizontal,
};

/** Código WMO de Open-Meteo → icono y texto. */
export function weatherInfo(code: number): { icon: LucideIcon; label: string } {
  if (code === 0) return { icon: Sun, label: 'Despejado' };
  if (code <= 2) return { icon: CloudSun, label: 'Parcialmente nublado' };
  if (code === 3) return { icon: Cloud, label: 'Nublado' };
  if (code <= 48) return { icon: CloudFog, label: 'Niebla' };
  if (code <= 57) return { icon: CloudDrizzle, label: 'Llovizna' };
  if (code <= 67) return { icon: CloudRain, label: 'Lluvia' };
  if (code <= 77) return { icon: CloudSnow, label: 'Nieve' };
  if (code <= 82) return { icon: CloudRain, label: 'Chubascos' };
  if (code <= 86) return { icon: CloudSnow, label: 'Nieve' };
  return { icon: CloudLightning, label: 'Tormenta' };
}

/** Región noreste → azul real (`ny`); sur / Florida → celeste (`fl`). */
export const cityClass = (c: City) => (cityMeta(c)?.region === 'ne' ? 'ny' : 'fl');
