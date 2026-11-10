import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceKm } from './schedule';

export interface LatLng {
  lat: number;
  lng: number;
}
export type TravelMode = 'foot' | 'bike' | 'car' | 'plane';

export const MODE_META: Record<TravelMode, { label: string; verb: string; color: string; gmaps: string }> = {
  foot: { label: 'A pie', verb: 'caminando', color: '#16a34a', gmaps: 'walking' },
  bike: { label: 'Bici', verb: 'en bici', color: '#f59e0b', gmaps: 'bicycling' },
  car: { label: 'Carro', verb: 'en carro', color: '#2f6bff', gmaps: 'driving' },
  plane: { label: 'Avión', verb: 'en avión', color: '#8b5cf6', gmaps: 'driving' },
};

export { distanceKm };
export const kmBetween = (a: LatLng, b: LatLng) => distanceKm(a, b);

/** «12 min», «1 h 05 min», «2 d 3 h» */
export function formatDuration(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')} min` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} d${h % 24 ? ` ${h % 24} h` : ''}`;
}

/** «450 m», «1,2 km», «4.150 km» */
export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 100 ? km.toLocaleString('es', { maximumFractionDigits: 1 }) : Math.round(km).toLocaleString('es')} km`;
}

/** Estimación sin conexión (línea recta × rodeo × velocidad media). */
export function estimate(mode: Exclude<TravelMode, 'plane'>, km: number): { distance: number; duration: number } {
  const detour = mode === 'car' ? 1.3 : 1.35;
  const road = km * detour;
  const speed = mode === 'foot' ? 4.8 : mode === 'bike' ? 14 : road < 15 ? 28 : 60;
  return { distance: road * 1000, duration: (road / speed) * 3600 };
}

/** Vuelo en línea recta: 800 km/h de crucero + ~45 min entre rodaje, despegue y aterrizaje. */
export function flightEstimate(km: number): { distance: number; duration: number; tooShort: boolean } {
  return { distance: km * 1000, duration: (km / 800) * 3600 + 45 * 60, tooShort: km < 150 };
}

/* ------------------------------ Ubicación del usuario ------------------------------ */

export type LocStatus = 'idle' | 'asking' | 'ready' | 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';
export interface Loc extends LatLng {
  accuracy: number;
  heading: number | null;
  at: number;
}

export const LOC_HELP: Record<Exclude<LocStatus, 'idle' | 'asking' | 'ready'>, string> = {
  denied: 'Bloqueaste la ubicación. Toca el candado junto a la dirección del sitio, permite «Ubicación» y vuelve a intentarlo.',
  unavailable: 'Tu dispositivo no pudo calcular dónde estás. Activa la ubicación (y el Wi‑Fi o el GPS) e inténtalo de nuevo.',
  timeout: 'Está tardando demasiado en encontrarte. Prueba cerca de una ventana o con el GPS activado.',
  unsupported: 'Este navegador no permite usar la ubicación.',
  insecure: 'La ubicación solo funciona en una conexión segura (https).',
};

/**
 * Ubicación con tres intentos: 1) rápida (red/Wi‑Fi), 2) de alta precisión si falló, 3) seguimiento continuo.
 * Así funciona también en computadores sin GPS, donde pedir «alta precisión» desde el principio suele agotar el tiempo.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocStatus>('idle');
  const [loc, setLoc] = useState<Loc | null>(null);
  const watchId = useRef<number | null>(null);
  const alive = useRef(true);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const toLoc = (p: GeolocationPosition): Loc => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, heading: p.coords.heading, at: p.timestamp });

  const startWatch = useCallback(() => {
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => alive.current && (setLoc(toLoc(p)), setStatus('ready')),
      (e) => {
        if (e.code === 1 && alive.current) setStatus('denied');
        // otros errores en el seguimiento se ignoran: ya hay una posición válida
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 60_000 },
    );
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('unsupported');
    if (!window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return setStatus('insecure');
    setStatus('asking');
    const ok = (p: GeolocationPosition) => {
      if (!alive.current) return;
      setLoc(toLoc(p));
      setStatus('ready');
      startWatch();
    };
    const fail = (e: GeolocationPositionError, last: boolean) => {
      if (!alive.current) return;
      if (e.code === 1) return setStatus('denied');
      if (!last) {
        navigator.geolocation.getCurrentPosition(ok, (e2) => fail(e2, true), { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
        return;
      }
      setStatus(e.code === 3 ? 'timeout' : 'unavailable');
    };
    navigator.geolocation.getCurrentPosition(ok, (e) => fail(e, false), { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 });
  }, [startWatch]);

  // Si el permiso ya estaba concedido, se activa solo (sin otro toque); si cambia, se reacciona.
  useEffect(() => {
    alive.current = true;
    let perm: PermissionStatus | null = null;
    const onChange = () => {
      if (!perm) return;
      if (perm.state === 'granted') start();
      else if (perm.state === 'denied') {
        stop();
        setStatus('denied');
      }
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        perm = p;
        p.addEventListener('change', onChange);
        if (p.state === 'granted') start();
        else if (p.state === 'denied') setStatus('denied');
      })
      .catch(() => undefined);
    return () => {
      alive.current = false;
      perm?.removeEventListener('change', onChange);
      stop();
    };
  }, [start, stop]);

  return { status, loc, start, stop };
}

/** Ubicación de una sola lectura, SOLO si el permiso ya estaba concedido (no pide permiso ni mantiene el GPS encendido). */
export function useQuickLocation(refreshKey = ''): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    let alive = true;
    if (!('geolocation' in navigator) || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (p.state !== 'granted' || !alive) return;
        navigator.geolocation.getCurrentPosition(
          (g) => alive && setPos({ lat: g.coords.latitude, lng: g.coords.longitude }),
          () => undefined,
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 180_000 },
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return pos;
}
