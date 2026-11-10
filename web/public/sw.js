/* Service worker: app shell offline + caché de datos de lectura.
 * - Navegación: red primero, con respaldo a index.html en caché.
 * - /assets/* (con hash) y fuentes: caché primero.
 * - /api/snapshot y /api/weather: red primero, con respaldo a caché.
 * - /api/attachments/*: caché primero (se ven sin conexión).
 * - Nunca intercepta escrituras ni el stream de eventos.
 */
const VERSION = 'v4';
const SHELL = `shell-${VERSION}`;
const DATA = `data-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest', '/theme-init.js'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA, 'photos-v1', 'tiles-v1', 'files-v1'].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl ?? request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    // Fotos de Wikimedia: caché primero (las miniaturas nunca cambian) para verlas sin conexión
    if (url.hostname === 'upload.wikimedia.org') {
      event.respondWith(
        caches.open('photos-v1').then(async (cache) => {
          const hit = await cache.match(request);
          if (hit) return hit;
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        }),
      );
      return;
    }
    // Mosaicos del mapa: caché primero (casi nunca cambian; así se ahorra red y batería y el mapa abre sin conexión)
    if (url.hostname.endsWith('tile.openstreetmap.org') || url.hostname === 'server.arcgisonline.com') {
      event.respondWith(
        caches.open('tiles-v1').then(async (cache) => {
          const cached = await cache.match(request);
          if (cached) return cached;
          const res = await fetch(request);
          if (res.ok || res.type === 'opaque') {
            cache.put(request, res.clone());
            // la caché de mosaicos no crece sin límite: se conservan los ~1200 más recientes
            if (Math.random() < 0.05) cache.keys().then((keys) => keys.length > 1500 && Promise.all(keys.slice(0, keys.length - 1200).map((k) => cache.delete(k))));
          }
          return res;
        }),
      );
    }
    return;
  }

  if (url.pathname === '/api/events' || url.pathname.startsWith('/api/auth')) return;
  if (url.pathname === '/api/snapshot' || url.pathname === '/api/weather') {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
  // Archivos adjuntos (pases de abordar, capturas): el contenido de un id nunca cambia → caché primero.
  if (/^\/api\/attachments\/[\w-]+$/.test(url.pathname)) {
    event.respondWith(
      caches.open('files-v1').then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'));
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(woff2?|png|svg|webmanifest)$|\/theme-init\.js$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
