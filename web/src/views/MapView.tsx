import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { Car, Footprints, Layers, LocateFixed, Loader2, Maximize2, MapPinOff, MapPinPlus, Minimize2, Minus, Navigation, Plus } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITY_META } from '../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex, formatTime12 } from '../../../shared/time';
import type { Activity, City } from '../../../shared/types';
import { MapSearch } from '../components/map/MapSearch';
import { PlaceCard } from '../components/map/PlaceCard';
import { RoutePanel } from '../components/map/RoutePanel';
import type { Dest, Origin, OriginKind, Stop } from '../components/map/types';
import { Seg } from '../components/ui/Seg';
import { Photo } from '../components/photos/Photo';
import { api } from '../lib/api';
import { LOC_HELP, MODE_META, formatDistance, formatDuration, kmBetween, useLocation, type LatLng, type TravelMode } from '../lib/geo';
import { estimateLegs, planWalk, type WalkPlan } from '../lib/walk';
import { CATEGORY_ICON, cityClass } from '../lib/meta';
import { photoForActivity } from '../lib/photos';
import { computeRoutes, defaultMode, type RouteSet } from '../lib/routing';
import { dayActivities } from '../lib/selectors';
import { useStore } from '../store';

type Scope = 'day' | City | 'all';

const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const TILES = {
  // El tema oscuro usa los mismos mosaicos con los colores invertidos por CSS (ver .map-box.dark en map.css)
  map: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'abc', max: 19, attr: OSM_ATTR },
  sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: '', max: 19, attr: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
} as const;

const pinHtml = (s: Stop, selected: boolean, focus: boolean, dot: boolean) =>
  `<span class="pin ${cityClass(s.city)}${s.a.done ? ' done' : ''}${focus ? '' : ' dim'}${dot ? ' dot' : ''}${selected ? ' sel' : ''}">${dot ? '' : s.n}</span>`;
const pinIcon = (s: Stop, selected: boolean, focus: boolean, dot: boolean) =>
  L.divIcon({ className: 'pin-wrap', html: pinHtml(s, selected, focus, dot), iconSize: dot ? [16, 16] : [30, 30], iconAnchor: dot ? [8, 8] : [15, 15] });

export default function MapView() {
  const snap = useStore((s) => s.snap)!;
  const date = useStore((s) => s.selectedDate);
  const selectDate = useStore((s) => s.selectDate);
  const setTab = useStore((s) => s.setTab);
  const openAddPlace = useStore((s) => s.openAddPlace);
  const openDetail = useStore((s) => s.openDetail);
  const toast = useStore((s) => s.toast);
  const theme = useStore((s) => s.theme);

  const [scope, setScope] = useState<Scope>('day');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dest, setDest] = useState<Dest | null>(null);
  const [originKind, setOriginKind] = useState<OriginKind>('me');
  const [pinOrigin, setPinOrigin] = useState<LatLng | null>(null);
  const [hotelPt, setHotelPt] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [pinning, setPinning] = useState<null | 'dest' | 'origin'>(null);
  const [routes, setRoutes] = useState<RouteSet | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [mode, setMode] = useState<TravelMode>('foot');
  const [kind, setKind] = useState<'map' | 'sat'>('map');
  const [tall, setTall] = useState(false);
  const modeTouched = useRef(false);

  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const stopsLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const walkLayer = useRef<L.LayerGroup | null>(null);
  const destMarker = useRef<L.Marker | null>(null);
  const originMarker = useRef<L.Marker | null>(null);
  const meGroup = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { mk: L.Marker; stop: Stop; focus: boolean; dot: boolean }>());
  const pinningRef = useRef(pinning);
  pinningRef.current = pinning;

  const geo = useLocation();
  const wantFly = useRef(false);

  const day = snap.days.find((d) => d.date === date) ?? snap.days[0];
  const cities = useMemo(() => [...new Set(snap.days.map((d) => d.city))], [snap.days]);
  const tz = snap.trip.timezone;

  const sysDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'auto' && sysDark);

  /* ------------------------------ Paradas ------------------------------ */
  const cityOf = useCallback(
    (a: Activity, fallback: City): City => {
      let best = fallback;
      let bestKm = Infinity;
      for (const c of cities) {
        const km = distanceKm({ lat: a.lat!, lng: a.lng! }, CITY_META[c]);
        if (km < bestKm) {
          bestKm = km;
          best = c;
        }
      }
      return best;
    },
    [cities],
  );

  const { stops, missing } = useMemo(() => {
    const dayList = scope === 'day' ? [day] : snap.days;
    const out: Stop[] = [];
    let miss = 0;
    for (const d of dayList) {
      let n = 0;
      for (const a of dayActivities(snap, d.date)) {
        if (a.lat == null || a.lng == null) {
          if (scope === 'day' || scope === 'all' || d.city === scope) miss++;
          continue;
        }
        const city = cityOf(a, d.city);
        n++;
        if (scope !== 'day' && scope !== 'all' && city !== scope) continue;
        out.push({ a, n, city });
      }
    }
    return { stops: out, missing: miss };
  }, [snap, scope, day, cityOf]);

  const tripWithCoords = useMemo(() => snap.activities.filter((a) => a.lat != null && a.lng != null), [snap.activities]);
  const selectedStop = selectedId ? (stops.find((s) => s.a.id === selectedId) ?? null) : null;

  const drawSig = stops.map((s) => `${s.a.id}|${s.a.lat}|${s.a.lng}|${s.n}|${s.a.done ? 1 : 0}`).join(';');
  const fitSig = `${scope}|${scope === 'day' ? date : ''}|${stops.map((s) => `${s.a.id}|${s.a.lat}|${s.a.lng}`).join(';')}`;

  /* ------------------------------ Recorrido a pie del día ------------------------------ */
  const walkStops = useMemo(() => (scope === 'day' ? stops.map((s) => ({ id: s.a.id, lat: s.a.lat!, lng: s.a.lng! })) : []), [scope, stops]);
  const walkSig = walkStops.map((s) => `${s.id}:${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join('|');
  const [walkState, setWalkState] = useState<{ sig: string; plan: WalkPlan } | null>(null);
  const [walkLoading, setWalkLoading] = useState(false);
  useEffect(() => {
    if (walkStops.length < 2) {
      setWalkState(null);
      return;
    }
    const ctrl = new AbortController();
    setWalkLoading(true);
    const t = setTimeout(async () => {
      try {
        const plan = await planWalk(walkStops, ctrl.signal);
        setWalkState({ sig: walkSig, plan });
      } catch {
        /* cancelado: llega otra consulta */
      } finally {
        if (!ctrl.signal.aborted) setWalkLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkSig]);
  const realWalk = walkState && walkState.sig === walkSig ? walkState.plan : null;
  const legs = useMemo(() => realWalk?.legs ?? estimateLegs(walkStops), [realWalk, walkStops]);
  const legMap = useMemo(() => new Map(legs.map((l) => [`${l.from}>${l.to}`, l])), [legs]);
  const walkTotals = useMemo(() => {
    const foot = legs.filter((l) => l.mode === 'foot');
    return { dist: foot.reduce((n, l) => n + l.distance, 0), time: foot.reduce((n, l) => n + l.duration, 0), cars: legs.filter((l) => l.mode === 'car').length, approx: legs.some((l) => l.approx) };
  }, [legs]);

  /* ------------------------------ Mapa ------------------------------ */
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 }).setView([40.7549, -73.984], 12);
    m.attributionControl.setPrefix(false);
    stopsLayer.current = L.layerGroup().addTo(m);
    walkLayer.current = L.layerGroup().addTo(m);
    routeLayer.current = L.layerGroup().addTo(m);
    meGroup.current = L.layerGroup().addTo(m);
    map.current = m;
    // Las etiquetas de tiempo de cada tramo solo se ven con el zoom suficiente (si no, se amontonan)
    const legZoom = () => box.current?.classList.toggle('hide-legs', m.getZoom() < 15.5);
    m.on('zoomend', legZoom);
    legZoom();
    m.on('click', (e: L.LeafletMouseEvent) => {
      const p = pinningRef.current;
      if (p === 'dest') {
        setDest({ name: 'Punto elegido en el mapa', lat: e.latlng.lat, lng: e.latlng.lng, source: 'pin' });
        setSelectedId(null);
        setPinning(null);
      } else if (p === 'origin') {
        setPinOrigin({ lat: e.latlng.lat, lng: e.latlng.lng });
        setOriginKind('pin');
        setPinning(null);
      } else setSelectedId(null);
    });
    const raf = requestAnimationFrame(() => m.invalidateSize());
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      m.remove();
      map.current = null;
      tiles.current = null;
    };
  }, []);

  // Capa de fondo: mapa claro/oscuro (según el tema) o satélite
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const t = TILES[kind];
    tiles.current?.remove();
    tiles.current = L.tileLayer(t.url, { maxZoom: t.max, subdomains: t.sub || 'abc', attribution: t.attr }).addTo(m);
    tiles.current.bringToBack();
  }, [kind]);

  useEffect(() => {
    box.current?.classList.toggle('dark', dark && kind === 'map');
  }, [dark, kind]);

  // Cursor de «elegir en el mapa»
  useEffect(() => {
    box.current?.classList.toggle('pinning', !!pinning);
  }, [pinning]);

  // Marcadores
  useEffect(() => {
    const m = map.current;
    const g = stopsLayer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    const dot = scope !== 'day';
    const cluster = dot
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 46,
          spiderfyOnMaxZoom: true,
          chunkedLoading: true,
          iconCreateFunction: (c) => {
            const n = c.getChildCount();
            return L.divIcon({ className: 'cluster-wrap', html: `<span class="cluster">${n}</span>`, iconSize: [38, 38] });
          },
        })
      : null;

    const byDay = new Map<string, Stop[]>();
    for (const s of stops) byDay.set(s.a.dayDate, [...(byDay.get(s.a.dayDate) ?? []), s]);
    for (const [d, list] of byDay) {
      const focus = scope === 'day' || d === date;
      for (const s of list) {
        const mk = L.marker([s.a.lat!, s.a.lng!], { icon: pinIcon(s, false, focus, dot), title: s.a.text, keyboard: true });
        mk.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedId(s.a.id);
          setDest(null);
        });
        markers.current.set(s.a.id, { mk, stop: s, focus, dot });
        (cluster ?? g).addLayer(mk);
      }
    }
    if (cluster) g.addLayer(cluster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSig, scope, date]);

  // Rutas a pie reales entre paradas (o líneas punteadas mientras llegan / si no hay conexión)
  useEffect(() => {
    const g = walkLayer.current;
    if (!g) return;
    g.clearLayers();
    if (walkStops.length < 2) return;
    const geo: Array<[number, number]> = [];
    if (realWalk) {
      for (const ln of realWalk.lines) {
        if (ln.geometry.length < 2) continue;
        ln.geometry.forEach((p) => geo.push(p));
        L.polyline(ln.geometry, { color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g);
        L.polyline(ln.geometry, { color: MODE_META.foot.color, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: ln.approx ? '2 9' : undefined, interactive: false }).addTo(g);
      }
    }
    // traslados largos (o todo, si aún no hay rutas): línea recta punteada
    legs.forEach((l, i) => {
      const a = walkStops[i];
      const b = walkStops[i + 1];
      if (!a || !b) return;
      if (l.mode === 'car' || !realWalk) {
        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: l.mode === 'car' ? '#64748b' : '#2f6bff', weight: 3, opacity: 0.85, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(g);
      }
    });
    // etiquetas con el tiempo de cada tramo
    legs.forEach((l, i) => {
      const a = walkStops[i];
      const b = walkStops[i + 1];
      if (!a || !b || l.distance < 60) return;
      const mid: [number, number] = [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2];
      let pos = mid;
      if (l.mode === 'foot' && geo.length) {
        // el punto del recorrido real más cercano al punto medio entre las dos paradas
        let best = Infinity;
        for (const p of geo) {
          const d = (p[0] - mid[0]) ** 2 + (p[1] - mid[1]) ** 2;
          if (d < best) {
            best = d;
            pos = p;
          }
        }
      }
      L.marker(pos, {
        icon: L.divIcon({ className: 'leg-wrap', html: `<span class="leg-tag ${l.mode}">${l.mode === 'car' ? '🚗' : '🚶'} ${l.approx ? '~' : ''}${formatDuration(l.duration)}</span>`, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -100,
      }).addTo(g);
    });
  }, [realWalk, legs, walkStops]);

  // Resaltar la parada seleccionada (solo se cambian dos íconos)
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    const paint = (id: string | null, sel: boolean) => {
      const e = id ? markers.current.get(id) : null;
      if (e) e.mk.setIcon(pinIcon(e.stop, sel, e.focus, e.dot));
    };
    paint(lastSel.current, false);
    paint(selectedId, true);
    lastSel.current = selectedId;
    const e = selectedId ? markers.current.get(selectedId) : null;
    if (e && map.current) map.current.setView(e.mk.getLatLng(), Math.max(map.current.getZoom(), 15), { animate: true });
  }, [selectedId, drawSig]);

  // Encuadre: solo cuando cambia la vista, no en cada sincronización
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.invalidateSize();
    m.stop();
    if (stops.length === 0) {
      const c = CITY_META[scope === 'day' || scope === 'all' ? day.city : scope];
      m.setView([c.lat, c.lng], 11, { animate: false });
      return;
    }
    let pts = stops.map((s) => [s.a.lat!, s.a.lng!] as [number, number]);
    if (scope !== 'day' && scope !== 'all') {
      const med = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
      const c = { lat: med(pts.map((p) => p[0])), lng: med(pts.map((p) => p[1])) };
      const core = pts.filter((p) => kmBetween({ lat: p[0], lng: p[1] }, c) <= 40);
      if (core.length > 0) pts = core;
    }
    if (pts.length === 1) m.setView(pts[0], 15, { animate: false });
    else m.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 84], paddingBottomRight: [40, 40], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSig]);

  /* ------------------------------ Mi ubicación ------------------------------ */
  useEffect(() => {
    const g = meGroup.current;
    if (!g) return;
    g.clearLayers();
    if (!geo.loc) return;
    const ll: [number, number] = [geo.loc.lat, geo.loc.lng];
    if (geo.loc.accuracy < 1500) L.circle(ll, { radius: geo.loc.accuracy, color: '#2f6bff', weight: 1, fillColor: '#2f6bff', fillOpacity: 0.12, interactive: false }).addTo(g);
    L.marker(ll, { icon: L.divIcon({ className: 'me-wrap', html: '<span class="me"><i></i></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, zIndexOffset: 900 }).addTo(g);
  }, [geo.loc]);

  useEffect(() => {
    if (geo.loc && wantFly.current) {
      wantFly.current = false;
      map.current?.flyTo([geo.loc.lat, geo.loc.lng], 16, { duration: 0.8 });
    }
  }, [geo.loc]);
  useEffect(() => {
    if (wantFly.current && ['denied', 'unavailable', 'timeout', 'unsupported', 'insecure'].includes(geo.status)) {
      wantFly.current = false;
      toast(LOC_HELP[geo.status as keyof typeof LOC_HELP], 'error');
    }
  }, [geo.status, toast]);

  function locate() {
    if (geo.loc) {
      map.current?.flyTo([geo.loc.lat, geo.loc.lng], Math.max(map.current.getZoom(), 16), { duration: 0.7 });
      return;
    }
    wantFly.current = true;
    geo.start();
  }

  /* ------------------------------ Hotel como punto de partida ------------------------------ */
  const hotelRes = useMemo(
    () => snap.reservations.find((r) => r.kind === 'hotel' && r.startsAt.slice(0, 10) <= date && (r.endsAt.slice(0, 10) > date || r.endsAt.slice(0, 10) === date)) ?? snap.reservations.find((r) => r.kind === 'hotel' && r.city === day.city),
    [snap.reservations, date, day.city],
  );
  const hotelAct = useMemo(() => snap.activities.find((a) => a.dayDate === date && a.category === 'lodging' && a.lat != null) ?? snap.activities.find((a) => a.category === 'lodging' && a.lat != null && cityOfSimple(a, day.city, cities) === day.city), [snap.activities, date, day.city, cities]);
  const hasHotel = !!(hotelAct || hotelRes);

  const resolveHotel = useCallback(async (): Promise<boolean> => {
    if (hotelAct) {
      setHotelPt({ lat: hotelAct.lat!, lng: hotelAct.lng!, label: hotelAct.place || 'Mi hotel' });
      return true;
    }
    if (hotelRes) {
      try {
        const r = await api.geocode(hotelRes.address || hotelRes.title, day.city);
        if (r[0]) {
          setHotelPt({ lat: r[0].lat, lng: r[0].lng, label: hotelRes.title });
          return true;
        }
      } catch {
        /* sin conexión */
      }
    }
    return false;
  }, [hotelAct, hotelRes, day.city]);

  const origin: Origin | null =
    originKind === 'me' ? (geo.loc ? { kind: 'me', lat: geo.loc.lat, lng: geo.loc.lng, label: 'Mi ubicación' } : null) : originKind === 'hotel' ? (hotelPt ? { kind: 'hotel', ...hotelPt } : null) : pinOrigin ? { kind: 'pin', ...pinOrigin, label: 'Punto del mapa' } : null;

  function chooseOrigin(k: OriginKind) {
    setOriginKind(k);
    if (k === 'me') {
      if (!geo.loc) geo.start();
    } else if (k === 'hotel') void resolveHotel().then((ok) => !ok && toast('No encontré dónde queda tu hotel.', 'error'));
    else {
      setPinning('origin');
      toast('Toca el mapa para elegir el punto de partida');
    }
  }

  // Sin ubicación: se sale del hotel automáticamente (una sola vez por destino)
  const autoHotel = useRef<string>('');
  useEffect(() => {
    if (!dest || originKind !== 'me' || geo.loc || !['denied', 'unavailable', 'timeout', 'unsupported', 'insecure'].includes(geo.status)) return;
    const k = `${dest.lat},${dest.lng}`;
    if (autoHotel.current === k || !hasHotel) return;
    autoHotel.current = k;
    void resolveHotel().then((ok) => {
      if (ok) {
        setOriginKind('hotel');
        toast('No pude ubicarte: calculo desde tu hotel.');
      }
    });
  }, [dest, originKind, geo.loc, geo.status, hasHotel, resolveHotel, toast]);

  /* ------------------------------ Destino y rutas ------------------------------ */
  function goTo(d: Dest) {
    setDest(d);
    setSelectedId(null);
    modeTouched.current = false;
    setRoutes(null);
    if (originKind === 'me' && !geo.loc && geo.status === 'idle') geo.start();
    box.current?.closest('.map-frame')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function closeDest() {
    setDest(null);
    setRoutes(null);
    setPinning(null);
  }

  // «Cómo llegar» desde el plan del día: el mapa abre directo la ruta a ese lugar
  const mapGoto = useStore((s) => s.mapGoto);
  useEffect(() => {
    if (!mapGoto) return;
    goTo({ name: mapGoto.name, lat: mapGoto.lat, lng: mapGoto.lng, source: 'stop', activityId: mapGoto.activityId });
    useStore.getState().setMapGoto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapGoto]);

  const originKey = origin ? `${origin.kind}|${origin.lat.toFixed(3)}|${origin.lng.toFixed(3)}` : '';
  useEffect(() => {
    if (!dest || !origin) {
      setRoutes(null);
      setLoadingRoutes(false);
      return;
    }
    const ctrl = new AbortController();
    setLoadingRoutes(true);
    const t = setTimeout(async () => {
      try {
        const set = await computeRoutes(origin, dest, ctrl.signal);
        setRoutes(set);
        if (!modeTouched.current) setMode(defaultMode(set));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setRoutes(null);
      } finally {
        if (!ctrl.signal.aborted) setLoadingRoutes(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest?.lat, dest?.lng, originKey]);

  // Dibujo de la ruta
  const routeFit = useRef('');
  useEffect(() => {
    const m = map.current;
    const g = routeLayer.current;
    if (!m || !g) return;
    g.clearLayers();
    destMarker.current?.remove();
    originMarker.current?.remove();
    destMarker.current = null;
    originMarker.current = null;
    if (!dest) return;
    destMarker.current = L.marker([dest.lat, dest.lng], { icon: L.divIcon({ className: 'dest-wrap', html: '<span class="dest-pin"></span>', iconSize: [34, 44], iconAnchor: [17, 42] }), zIndexOffset: 800, keyboard: false }).addTo(m);
    if (origin && origin.kind !== 'me') originMarker.current = L.marker([origin.lat, origin.lng], { icon: L.divIcon({ className: 'org-wrap', html: `<span class="org-pin">${origin.kind === 'hotel' ? 'H' : 'A'}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 700, keyboard: false }).addTo(m);
    const cur = routes?.[mode];
    if (origin && cur?.geometry && cur.geometry.length > 1) {
      const color = MODE_META[mode].color;
      L.polyline(cur.geometry, { color: '#fff', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(g);
      L.polyline(cur.geometry, { color, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: mode === 'plane' ? '2 12' : undefined }).addTo(g);
      const k = `${dest.lat},${dest.lng}|${originKey}|${mode}`;
      if (routeFit.current !== k) {
        routeFit.current = k;
        const b = L.latLngBounds(cur.geometry);
        b.extend([origin.lat, origin.lng]).extend([dest.lat, dest.lng]);
        const bottom = window.innerWidth < 640 ? 330 : 120;
        m.fitBounds(b, { paddingTopLeft: [40, 90], paddingBottomRight: [40, bottom], maxZoom: 17, animate: true });
      }
    } else if (!origin) {
      m.setView([dest.lat, dest.lng], Math.max(m.getZoom(), 15), { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest, routes, mode, originKey]);

  const getCenter = useCallback((): LatLng => {
    const c = map.current?.getCenter();
    return c ? { lat: c.lat, lng: c.lng } : CITY_META[day.city];
  }, [day.city]);

  const grouped = useMemo(() => {
    const m = new Map<string, Stop[]>();
    for (const s of stops) m.set(s.a.dayDate, [...(m.get(s.a.dayDate) ?? []), s]);
    return [...m.entries()];
  }, [stops]);

  const meters = (a: Activity) => (geo.loc && a.lat != null && a.lng != null ? kmBetween(geo.loc, { lat: a.lat, lng: a.lng }) * 1000 : null);
  const goStop = (s: Stop) => goTo({ name: s.a.place || s.a.text, lat: s.a.lat!, lng: s.a.lng!, source: 'stop', activityId: s.a.id });

  return (
    <div className="container map-view">
      <div className="map-toolbar">
        <Seg
          value={scope}
          onChange={(v) => setScope(v)}
          label="Alcance del mapa"
          options={[{ value: 'day', label: 'Día' }, ...cities.map((c) => ({ value: c as Scope, label: CITY_META[c].name })), { value: 'all', label: 'Todo' }]}
        />
        <button className="btn sm accent" onClick={() => openAddPlace({ date })}>
          <MapPinPlus size={16} /> Añadir lugar
        </button>
        <div className="day-chips" role="group" aria-label="Elegir día">
          {snap.days.map((d) => (
            <button
              key={d.date}
              className="chip pick day-chip"
              aria-pressed={scope === 'day' && d.date === date}
              onClick={() => {
                selectDate(d.date);
                if (scope !== 'day') setScope('day');
              }}
            >
              <i className="cat-dot" style={{ background: cityClass(d.city) === 'ny' ? 'var(--ny)' : 'var(--fl-bright)' }} />
              {DOW_ES[dowIndex(d.date)].slice(0, 3)} {dayOfMonth(d.date)}
            </button>
          ))}
        </div>
      </div>

      <div className="map-grid">
        <div ref={frame} className={`map-frame card${tall ? ' tall' : ''}${dest || selectedStop ? ' has-panel' : ''}`}>
          <div ref={box} className="map-box" role="application" aria-label="Mapa del viaje" />

          {/* Controles sobre el mapa */}
          <div className="map-ui">
            <MapSearch
              trip={tripWithCoords}
              city={day.city}
              me={geo.loc ? { lat: geo.loc.lat, lng: geo.loc.lng } : null}
              getCenter={getCenter}
              onPick={goTo}
              onPin={() => setPinning('dest')}
              pinning={pinning === 'dest'}
            />

            <div className="map-tools">
              <button type="button" className={`mt-btn${geo.loc ? ' on' : ''}`} onClick={locate} aria-label="Ir a mi ubicación" title="Mi ubicación">
                {geo.status === 'asking' ? <Loader2 size={20} className="spin" /> : <LocateFixed size={20} />}
              </button>
              <button type="button" className={`mt-btn${kind === 'sat' ? ' on' : ''}`} onClick={() => setKind((k) => (k === 'map' ? 'sat' : 'map'))} aria-label={kind === 'map' ? 'Ver satélite' : 'Ver mapa'} title={kind === 'map' ? 'Satélite' : 'Mapa'}>
                <Layers size={20} />
              </button>
              <button type="button" className="mt-btn" onClick={() => setTall((t) => !t)} aria-label={tall ? 'Reducir el mapa' : 'Agrandar el mapa'} title={tall ? 'Reducir' : 'Agrandar'}>
                {tall ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <div className="mt-zoom">
                <button type="button" className="mt-btn" onClick={() => map.current?.zoomIn()} aria-label="Acercar">
                  <Plus size={20} />
                </button>
                <button type="button" className="mt-btn" onClick={() => map.current?.zoomOut()} aria-label="Alejar">
                  <Minus size={20} />
                </button>
              </div>
            </div>

            {pinning && (
              <div className="map-banner" role="status">
                <span>{pinning === 'dest' ? 'Toca el mapa para elegir el destino' : 'Toca el mapa para elegir el punto de partida'}</span>
                <button type="button" onClick={() => setPinning(null)}>
                  Cancelar
                </button>
              </div>
            )}
            {!pinning && geo.status === 'asking' && !geo.loc && (
              <div className="map-banner" role="status">
                <Loader2 size={14} className="spin" /> <span>Buscando tu ubicación…</span>
              </div>
            )}

            <div className="map-bottom">
              {dest ? (
                <RoutePanel
                  dest={dest}
                  origin={origin}
                  originKind={originKind}
                  routes={routes}
                  loading={loadingRoutes}
                  mode={mode}
                  tz={tz}
                  locStatus={geo.status}
                  hasHotel={hasHotel}
                  onMode={(m) => {
                    modeTouched.current = true;
                    setMode(m);
                  }}
                  onOrigin={chooseOrigin}
                  onRequestLocation={() => (setOriginKind('me'), geo.start())}
                  onClose={closeDest}
                />
              ) : selectedStop ? (
                <PlaceCard
                  stop={selectedStop}
                  meters={meters(selectedStop.a)}
                  onGo={() => goStop(selectedStop)}
                  onPlan={() => {
                    selectDate(selectedStop.a.dayDate);
                    setTab('itinerario');
                    openDetail(selectedStop.a.id);
                  }}
                  onClose={() => setSelectedId(null)}
                />
              ) : null}
            </div>
          </div>
        </div>

        <aside className="card stops">
          <h2 className="card-title h-stretch">
            {scope === 'day' ? `Paradas del ${dayOfMonth(day.date)}` : 'Paradas'}
            <span className="chip">{stops.length}</span>
          </h2>
          {scope === 'day' && stops.length > 1 && (
            <div className="walk-sum" role="status">
              <Footprints size={16} />
              <span>
                <strong>
                  {walkTotals.approx ? '~' : ''}
                  {formatDistance(walkTotals.dist)} · {formatDuration(walkTotals.time)}
                </strong>{' '}
                a pie entre paradas{walkTotals.cars > 0 ? ` · ${walkTotals.cars} ${walkTotals.cars === 1 ? 'traslado' : 'traslados'} en carro` : ''}
              </span>
              {walkLoading && <Loader2 size={14} className="spin" />}
            </div>
          )}
          {stops.length === 0 ? (
            <div className="empty-state">
              <MapPinOff />
              <strong>Sin lugares ubicados</strong>
              <span>Abre una actividad y usa “Ubicar” para verla en el mapa.</span>
              <button className="btn sm" onClick={() => setTab('itinerario')}>
                Ir al itinerario
              </button>
            </div>
          ) : (
            <div className="stops-scroll">
              {grouped.map(([d, list]) => (
                <div key={d} className="stop-group">
                  {scope !== 'day' && (
                    <h3 className="stop-day">
                      {DOW_ES[dowIndex(d)]} {dayOfMonth(d)} · {CITY_META[list[0].city].name}
                    </h3>
                  )}
                  <ol>
                    {list.map((s, idx) => {
                      const nextStop = list[idx + 1];
                      const leg = scope === 'day' && nextStop ? legMap.get(`${s.a.id}>${nextStop.a.id}`) : undefined;
                      const ph = photoForActivity(s.a);
                      const Icon = CATEGORY_ICON[s.a.category];
                      const mt = meters(s.a);
                      return (
                        <Fragment key={s.a.id}>
                        <li>
                          <div className={`stop${selectedId === s.a.id ? ' sel' : ''}`}>
                            <button
                              className="stop-main"
                              onClick={() => {
                                setSelectedId(s.a.id);
                                setDest(null);
                                frame.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                              }}
                            >
                              <span className={`pin static ${cityClass(s.city)}${s.a.done ? ' done' : ''}`}>{s.n}</span>
                              {ph ? (
                                <Photo className="stop-thumb" photo={ph} width={500} alt="" />
                              ) : (
                                <span className={`stop-thumb stop-thumb-empty cat-${s.a.category}`} aria-hidden="true">
                                  <Icon size={18} />
                                </span>
                              )}
                              <span className="stop-text">
                                <strong>{s.a.text}</strong>
                                <small>{[s.a.time && formatTime12(s.a.time), s.a.place, mt != null && `a ${formatDistance(mt)}`].filter(Boolean).join(' · ')}</small>
                              </span>
                            </button>
                            <button className="icon-btn sm" onClick={() => goStop(s)} aria-label={`Cómo llegar a ${s.a.text}`} title="Cómo llegar">
                              <Navigation size={15} />
                            </button>
                          </div>
                        </li>
                        {leg && (
                          <li className={`leg-row ${leg.mode}`} aria-label={`${leg.mode === 'car' ? 'En carro' : 'A pie'}: ${formatDuration(leg.duration)}`}>
                            {leg.mode === 'car' ? <Car size={13} /> : <Footprints size={13} />}
                            <span>
                              {leg.approx ? '~' : ''}
                              {formatDuration(leg.duration)} · {formatDistance(leg.distance)}
                              {leg.mode === 'car' ? ' en carro' : ' a pie'}
                            </span>
                          </li>
                        )}
                        </Fragment>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
          {missing > 0 && stops.length > 0 && <small className="muted">{missing === 1 ? '1 actividad sin ubicación no aparece' : `${missing} actividades sin ubicación no aparecen`} en el mapa.</small>}
        </aside>
      </div>
    </div>
  );
}

function distanceKm(a: LatLng, b: LatLng) {
  return kmBetween(a, b);
}
/** Ciudad más cercana por coordenadas (sin depender del estado de la vista). */
function cityOfSimple(a: Activity, fallback: City, cities: City[]): City {
  let best = fallback;
  let bestKm = Infinity;
  for (const c of cities) {
    const km = kmBetween({ lat: a.lat!, lng: a.lng! }, CITY_META[c]);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return best;
}
