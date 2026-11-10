import type { Reservation } from '../../../shared/types';

export type FieldKey = 'provider' | 'flightNo' | 'confirmation' | 'url' | 'files' | 'dates' | 'address';
export interface Slot {
  key: FieldKey;
  label: string;
  ok: boolean;
}

/** Qué datos conviene tener de cada reserva, y cuáles ya están. */
export function completeness(r: Reservation, files: number): { slots: Slot[]; done: number; total: number } {
  const slots: Slot[] =
    r.kind === 'flight'
      ? [
          { key: 'provider', label: 'Aerolínea', ok: !!r.provider },
          { key: 'flightNo', label: 'N.º de vuelo', ok: !!r.flightNo },
          { key: 'confirmation', label: 'N.º de reserva', ok: !!r.confirmation },
          { key: 'files', label: 'Pase de abordar', ok: files > 0 },
        ]
      : r.kind === 'hotel'
        ? [
            { key: 'provider', label: 'Plataforma', ok: !!r.provider },
            { key: 'confirmation', label: 'N.º de reserva', ok: !!r.confirmation },
            { key: 'url', label: 'Enlace', ok: !!r.url },
            { key: 'files', label: 'Captura o PDF', ok: files > 0 },
          ]
        : [
            { key: 'confirmation', label: 'N.º de reserva', ok: !!r.confirmation },
            { key: 'url', label: 'Enlace', ok: !!r.url },
            { key: 'files', label: 'Entrada o PDF', ok: files > 0 },
          ];
  return { slots, done: slots.filter((s) => s.ok).length, total: slots.length };
}
