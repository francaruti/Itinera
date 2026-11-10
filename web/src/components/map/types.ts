import type { Activity, City } from '../../../../shared/types';
import type { LatLng } from '../../lib/geo';

export interface Stop {
  a: Activity;
  /** Número dentro de su día */
  n: number;
  city: City;
}

export interface Dest extends LatLng {
  name: string;
  address?: string;
  source: 'stop' | 'catalog' | 'search' | 'pin';
  activityId?: string;
}

export type OriginKind = 'me' | 'hotel' | 'pin';
export interface Origin extends LatLng {
  kind: OriginKind;
  label: string;
}
