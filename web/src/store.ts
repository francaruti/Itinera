import { create } from 'zustand';
import { registrarDestinos } from '../../shared/constants';
import { nowInZone } from '../../shared/time';
import type { AccountUser, Attachment, Op, Snapshot, WeatherPayload } from '../../shared/types';
import { blobToBase64, cacheAttachment, prepareFile, uncacheAttachment, warmAttachments } from './lib/files';
import { uid } from './lib/uid';
import { ApiError, api, NetworkError } from './lib/api';
import type { Units } from './lib/weather';
import { applyOps, coalesce } from './lib/ops';

export type TabId = 'itinerario' | 'mapa' | 'clima' | 'reservas' | 'pendientes' | 'presupuesto' | 'info';
export const TABS: TabId[] = ['itinerario', 'mapa', 'clima', 'reservas', 'pendientes', 'presupuesto', 'info'];
export type ThemePref = 'auto' | 'light' | 'dark';
export type Status = 'loading' | 'ready' | 'locked' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

const LS = {
  snapshot: 'viaje:snapshot',
  outbox: 'viaje:outbox',
  selected: 'viaje:selected',
  theme: 'viaje:theme',
  weather: 'viaje:weather',
  units: 'viaje:units',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

/** Instantáneas guardadas por versiones anteriores no traen adjuntos. */
/** Normaliza la foto del viaje y registra sus destinos (también al leerla de la copia guardada sin conexión). */
const norm = (s: Snapshot | null): Snapshot | null => {
  if (!s) return s;
  registrarDestinos(s.destinos);
  return { ...s, attachments: s.attachments ?? [] };
};

// Estado de sincronización fuera de React: la verdad del servidor y las operaciones pendientes.
let base: Snapshot | null = null;
let outbox: Op[] = [];
let sending = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000;
let events: EventSource | undefined;
let toastSeq = 0;
let listenersBound = false;
let pollTimer: ReturnType<typeof setInterval> | undefined;

interface State {
  status: Status;
  snap: Snapshot | null;
  online: boolean;
  syncing: boolean;
  pending: number;
  selectedDate: string;
  tab: TabId;
  theme: ThemePref;
  weather: WeatherPayload | null;
  toasts: Toast[];
  searchOpen: boolean;
  settingsOpen: boolean;
  highlightId: string | null;
  authRequired: boolean;
  /** Ya se preguntó al servidor si la app pide acceso (hasta entonces, authRequired no es fiable). */
  authChecked: boolean;
  /** Cuenta con la que se inició sesión (null si el servidor no usa cuentas). */
  me: AccountUser | null;
  /** Mensaje en la pantalla de acceso (p. ej. acceso compartido desactivado). */
  lockNote: string;
  lightbox: string | null;
  /** Hoja de detalle de una actividad y hoja de alternativas (ids de actividad). */
  detailId: string | null;
  altsId: string | null;
  units: Units;
  addPlace: { query?: string; date?: string } | null;
  daySheet: { mode: 'edit' | 'add'; date?: string } | null;
  /** Hoja «Vuelos y hoteles» (con la pestaña inicial y, si se quiere, la reserva a resaltar). */
  docs: { kind: 'flight' | 'hotel' | 'ticket'; id?: string } | null;
  /** Destino que el mapa debe abrir al entrar (p. ej. desde «Cómo llegar» en el plan). */
  mapGoto: { name: string; lat: number; lng: number; activityId?: string } | null;

  init(): Promise<void>;
  refresh(): Promise<void>;
  dispatch(ops: Op | Op[]): void;
  /** Tras iniciar sesión o crear la contraseña: carga el viaje con esa cuenta. */
  enter(user: AccountUser): Promise<void>;
  logout(): Promise<void>;
  selectDate(date: string): void;
  setTab(tab: TabId): void;
  setTheme(theme: ThemePref): void;
  toast(message: string, kind?: Toast['kind'], action?: Toast['action']): void;
  dismissToast(id: number): void;
  removeWithUndo(label: string, remove: Op | Op[], restore: Op | Op[]): void;
  setSearchOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  openPhoto(key: string | null): void;
  openDetail(id: string | null): void;
  openAlts(id: string | null): void;
  flash(id: string): void;
  loadWeather(force?: boolean): Promise<void>;
  setUnits(u: Units): void;
  openAddPlace(opts: { query?: string; date?: string } | null): void;
  openDaySheet(s: { mode: 'edit' | 'add'; date?: string } | null): void;
  openDocs(d: { kind: 'flight' | 'hotel' | 'ticket'; id?: string } | null): void;
  setMapGoto(g: { name: string; lat: number; lng: number; activityId?: string } | null): void;
  addAttachments(reservationId: string, files: File[], label?: string): Promise<void>;
  removeAttachment(id: string): Promise<void>;
  labelAttachment(id: string, label: string): Promise<void>;
  replaceAll(data: unknown): Promise<void>;
  resetToOriginal(): Promise<void>;
}

export function tabFromHash(): TabId {
  const h = location.hash.replace(/^#\/?/, '') as TabId;
  return TABS.includes(h) ? h : 'itinerario';
}

function syncThemeColor(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1013' : '#ffffff');
}

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  syncThemeColor(pref);
}

function defaultDate(snap: Snapshot): string {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LS.selected);
  } catch {
    /* sin almacenamiento */
  }
  const dates = snap.days.map((d) => d.date);
  const today = nowInZone(snap.trip.timezone).date;
  if (dates.includes(today)) return today;
  if (saved && dates.includes(saved)) return saved;
  return dates[0] ?? today;
}

export const useStore = create<State>((set, get) => {
  const recompute = () => {
    const snap = base ? applyOps(base, outbox) : null;
    set({ snap, pending: outbox.length });
    const sel = get().selectedDate;
    if (snap && !snap.days.some((d) => d.date === sel)) set({ selectedDate: defaultDate(snap) });
  };
  const persist = () => {
    if (base) write(LS.snapshot, base);
    write(LS.outbox, outbox);
  };

  function scheduleFlush(delay = 350) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, delay);
  }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void flush();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  }

  async function flush() {
    if (sending || outbox.length === 0 || !base) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    let again = false;
    sending = outbox.length;
    const batch = outbox.slice(0, sending);
    set({ syncing: true });
    try {
      const { rev } = await api.ops(batch);
      const prevRev = base.rev;
      outbox = outbox.slice(batch.length);
      sending = 0;
      base = { ...applyOps(base, batch), rev };
      retryDelay = 2000;
      set({ online: true });
      persist();
      recompute();
      again = outbox.length > 0;
      if (rev > prevRev + batch.length) void get().refresh();
    } catch (err) {
      const failed = sending;
      sending = 0;
      if (err instanceof NetworkError) {
        set({ online: false });
        scheduleRetry();
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        set({ status: 'locked' });
      } else {
        // El servidor rechazó el lote: se descarta para no bloquear la cola.
        outbox = outbox.slice(failed);
        persist();
        recompute();
        get().toast('No se pudo guardar un cambio. Se restauró la versión del servidor.', 'error');
        void get().refresh();
      }
    } finally {
      set({ syncing: false });
      if (again) scheduleFlush(50);
    }
  }

  /** Al volver a la app: solo se descarga el viaje completo si el servidor tiene cambios (una petición mínima en vez de ~100 KB). */
  async function softRefresh() {
    if (sending > 0 || outbox.length > 0) return;
    try {
      const { rev } = await api.health();
      if (!base || rev > base.rev) await get().refresh();
      else set({ online: true });
    } catch {
      set({ online: false });
    }
  }

  function connectEvents() {
    events?.close();
    events = new EventSource('/api/events');
    events.addEventListener('rev', (e) => {
      const { rev } = JSON.parse((e as MessageEvent).data) as { rev: number };
      set({ online: true });
      if (sending === 0 && outbox.length > 0) scheduleFlush(50);
      else if (base && rev > base.rev && sending === 0) void get().refresh();
    });
    events.onerror = () => {
      if (!navigator.onLine) set({ online: false });
    };
  }

  /** Respaldo cuando SSE no está disponible (p. ej. hosting serverless): consulta la revisión cada 30 s. */
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || sending > 0 || outbox.length > 0) return;
      try {
        const { rev } = await api.health();
        if (base && rev > base.rev) void get().refresh();
      } catch {
        /* sin conexión: se reintenta en el próximo ciclo */
      }
    }, 30_000);
  }

  return {
    status: 'loading',
    snap: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
    pending: 0,
    selectedDate: '',
    tab: typeof location === 'undefined' ? 'itinerario' : tabFromHash(),
    // Claro por defecto; el usuario puede cambiarlo a oscuro o automático en Ajustes.
    theme: (['light', 'dark', 'auto'] as const).find((t) => t === localStorage.getItem(LS.theme)) ?? 'light',
    weather: read<WeatherPayload>(LS.weather),
    toasts: [],
    searchOpen: false,
    settingsOpen: false,
    highlightId: null,
    authRequired: false,
    authChecked: false,
    me: null,
    lockNote: '',
    lightbox: null,
    detailId: null,
    altsId: null,
    units: (localStorage.getItem(LS.units) as Units | null) === 'f' ? 'f' : 'c',
    addPlace: null,
    daySheet: null,
    docs: null,
    mapGoto: null,

    async init() {
      base = norm(read<Snapshot>(LS.snapshot));
      outbox = read<Op[]>(LS.outbox) ?? [];
      if (base) {
        set({ selectedDate: defaultDate(base), status: 'ready' });
        recompute();
      }
      if (!listenersBound) {
        listenersBound = true;
        window.addEventListener('online', () => {
          set({ online: true });
          void flush();
          void softRefresh();
        });
        window.addEventListener('offline', () => set({ online: false }));
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            void flush();
            void softRefresh();
          }
        });
      }

      try {
        const auth = await api.authStatus();
        set({ authRequired: auth.required, authChecked: true, me: auth.user });
        if (auth.required && !auth.authenticated) {
          set({ status: 'locked', lockNote: auth.sharingOff ? 'El acceso compartido está desactivado por ahora. Pídele a quien administra el viaje que lo active.' : '' });
          return;
        }
      } catch {
        if (!base) set({ status: 'error' });
        return;
      }
      await get().refresh();
      connectEvents();
      startPolling();
      void get().loadWeather();
      void flush();
    },

    async refresh() {
      if (sending) return;
      try {
        const snap = await api.snapshot();
        if (sending) return;
        base = norm(snap);
        persist();
        void warmAttachments(base!.attachments.map((a) => a.id));
        const first = get().selectedDate === '';
        set({ status: 'ready', online: true });
        if (first) set({ selectedDate: defaultDate(snap) });
        recompute();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) set({ status: 'locked', lockNote: err.status === 403 ? 'El acceso compartido está desactivado por ahora.' : '' });
        else {
          set({ online: false });
          if (!base) set({ status: 'error' });
        }
      }
    },

    dispatch(input) {
      const ops = Array.isArray(input) ? input : [input];
      for (const o of ops) outbox = coalesce(outbox, o, sending);
      persist();
      recompute();
      if (get().online) scheduleFlush();
    },

    async enter(user) {
      set({ status: 'loading', me: user, lockNote: '' });
      await get().refresh();
      connectEvents();
      startPolling();
      void get().loadWeather();
    },

    async logout() {
      await api.logout().catch(() => undefined);
      events?.close();
      base = null;
      outbox = [];
      localStorage.removeItem(LS.snapshot);
      localStorage.removeItem(LS.outbox);
      // Tras cerrar sesión, la pantalla de acceso (no la portada) es la que se ve.
      location.hash = '#/acceso';
      set({ snap: null, me: null, status: 'locked', settingsOpen: false });
    },

    selectDate(date) {
      write(LS.selected, date);
      set({ selectedDate: date });
    },

    setTab(tab) {
      if (location.hash !== `#/${tab}`) history.replaceState(null, '', `#/${tab}`);
      set({ tab });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setTheme(theme) {
      localStorage.setItem(LS.theme, theme);
      applyTheme(theme);
      set({ theme });
    },

    toast(message, kind = 'info', action) {
      const id = ++toastSeq;
      set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, kind, action }] }));
      setTimeout(() => get().dismissToast(id), action ? 7000 : 3600);
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    removeWithUndo(label, remove, restore) {
      get().dispatch(remove);
      get().toast(label, 'info', { label: 'Deshacer', run: () => get().dispatch(restore) });
    },

    setSearchOpen: (searchOpen) => set({ searchOpen }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    openPhoto: (lightbox) => set({ lightbox }),
    openDetail: (detailId) => set({ detailId }),
    openAlts: (altsId) => set({ altsId }),

    flash(id) {
      set({ highlightId: id });
      setTimeout(() => set((s) => (s.highlightId === id ? { highlightId: null } : s)), 2200);
    },

    async loadWeather(force = false) {
      try {
        const weather = await api.weather(force);
        if (Object.keys(weather.cities).length === 0 && get().weather) return;
        write(LS.weather, weather);
        set({ weather });
      } catch {
        /* se usa el último pronóstico guardado */
      }
    },

    setUnits(units) {
      write(LS.units, units);
      set({ units });
    },
    openAddPlace: (addPlace) => set({ addPlace }),
    openDaySheet: (daySheet) => set({ daySheet }),
    openDocs: (docs) => set({ docs }),
    setMapGoto: (mapGoto) => set({ mapGoto }),

    async addAttachments(reservationId, files, label = '') {
      for (const file of files) {
        let prepared;
        try {
          prepared = await prepareFile(file);
        } catch (err) {
          get().toast((err as Error).message, 'error');
          continue;
        }
        const id = uid().replace(/-/g, '').slice(0, 24);
        try {
          await cacheAttachment(id, prepared.blob);
          const { rev } = await api.putAttachment(id, { reservationId, name: prepared.name, label, mime: prepared.mime, data: await blobToBase64(prepared.blob) });
          if (base) {
            const meta: Attachment = { id, reservationId, name: prepared.name, label, mime: prepared.mime, size: prepared.blob.size, createdAt: Date.now() };
            base = { ...base, rev: Math.max(base.rev, rev), attachments: [...base.attachments, meta] };
            persist();
            recompute();
          }
          get().toast('Archivo guardado', 'success');
        } catch (err) {
          void uncacheAttachment(id);
          get().toast(err instanceof NetworkError ? 'Necesitas internet para subir archivos.' : err instanceof ApiError ? err.message : 'No se pudo guardar el archivo.', 'error');
        }
      }
    },

    async labelAttachment(id, label) {
      // Optimista: se ve al instante; si falla, la próxima sincronización lo corrige.
      if (base) {
        base = { ...base, attachments: base.attachments.map((a) => (a.id === id ? { ...a, label } : a)) };
        persist();
        recompute();
      }
      try {
        const { rev } = await api.labelAttachment(id, label);
        if (base) base = { ...base, rev: Math.max(base.rev, rev) };
      } catch {
        get().toast('No se pudo guardar el nombre (¿sin conexión?).', 'error');
      }
    },

    async removeAttachment(id) {
      try {
        const { rev } = await api.deleteAttachment(id);
        if (base) {
          base = { ...base, rev: Math.max(base.rev, rev), attachments: base.attachments.filter((a) => a.id !== id) };
          persist();
          recompute();
        }
        void uncacheAttachment(id);
        get().toast('Archivo eliminado');
      } catch {
        get().toast('No se pudo eliminar (¿sin conexión?).', 'error');
      }
    },

    async replaceAll(data) {
      await api.importData(data);
      await get().refresh();
    },

    async resetToOriginal() {
      outbox = [];
      await api.reset();
      await get().refresh();
    },
  };
});

applyTheme(useStore.getState().theme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => syncThemeColor(useStore.getState().theme));
