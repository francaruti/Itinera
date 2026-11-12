import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError } from 'zod';
import { plantilla } from '../../shared/plantilla';
import type { City, Op } from '../../shared/types';
import { createAuth, type AuthedRequest } from './auth';
import type { Config } from './config';
import type { Db } from './db';
import { HttpError } from './errors';
import { geocode } from './geocode';
import { routes as computeRoutes, walk } from './route';
import { destinoConocido, registrarDestinos } from '../../shared/constants';
import { buildIcs } from './ics';
import { destinoBody, opsBody } from './model';
import { rateLimit } from './ratelimit';
import { buildSeed } from './seed';
import { createHub } from './sse';
import { createStore, VIAJE_PREDETERMINADO } from './store';
import { createWeather } from './weather';

/** Página 404 para direcciones que no son la app (la app vive en /#/…). Lee el nombre de shared/plantilla.ts. */
function paginaNoEncontrada(): string {
  const nombre = plantilla.nombre.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Página no encontrada · ${nombre}</title>
<meta name="description" content="Esta dirección no existe en ${nombre}." />
<meta name="theme-color" content="#ffffff" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --ink: #222222; --muted: #6a6a6a; --accent: #2f6bff; --accent-strong: #1a3fb8; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --bg: #0f1013; --ink: #f5f5f5; --muted: #b0b0b8; } }
  body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 420px; text-align: center; }
  .code { margin: 0; color: var(--muted); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px; }
  h1 { margin: 8px 0 12px; font-size: 28px; line-height: 1.2; }
  p { margin: 0 0 24px; color: var(--muted); }
  a.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; border-radius: 12px; background: var(--accent); color: #ffffff; font-weight: 700; text-decoration: none; }
  a.btn:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <p class="code">Error 404</p>
  <h1>No encontramos esta página</h1>
  <p>La dirección no existe o cambió. Vuelve a ${nombre} para seguir con tu viaje.</p>
  <a class="btn" href="/">Ir a ${nombre}</a>
</main>
</body>
</html>
`;
}

export async function createApp(db: Db, config: Config, opts: { log?: boolean } = {}) {
  const hub = createHub();
  const store = createStore(db, (rev) => hub.broadcast(rev));
  if (await store.isEmpty()) await store.importSnapshot(buildSeed());
  const auth = await createAuth(store, config.accessCode, config.seedUsers);
  const getWeather = createWeather(store);
  /** Viaje de la petición: el de la cuenta que entró, o el de la clave del calendario. Sin cuentas, el viaje 1. */
  const viajeDe = (req: Request) => (req as AuthedRequest).user?.tripId ?? (req as AuthedRequest).viajeCalendario ?? VIAJE_PREDETERMINADO;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://server.arcgisonline.com', 'https://upload.wikimedia.org'],
          // El service worker pide los mosaicos del mapa y las fotos: sus fetch() se rigen por connect-src.
          connectSrc: ["'self'", 'https://upload.wikimedia.org', 'https://*.tile.openstreetmap.org', 'https://server.arcgisonline.com'],
          fontSrc: ["'self'", 'data:'],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // OpenStreetMap exige un Referer válido para servir mosaicos (basta el origen).
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression({ filter: (req, res) => (req.path === '/api/events' ? false : compression.filter(req, res)) }));
  const json2mb = express.json({ limit: '2mb' });
  // Los adjuntos traen su propio límite (más alto) en la ruta.
  app.use((req, res, next) => (req.path.startsWith('/api/attachments/') ? next() : json2mb(req, res, next)));

  if (opts.log) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api/')) console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }


  // --- Públicas -----------------------------------------------------------
  app.get('/api/health', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, rev: await store.rev(), clients: hub.size(), uptime: Math.round(process.uptime()) });
  });
  app.get('/api/auth/status', auth.status);
  app.post('/api/auth/start', rateLimit(20, 60_000), auth.start);
  app.post('/api/auth/login', rateLimit(10, 60_000), auth.login);
  app.post('/api/auth/setup', rateLimit(10, 60_000), auth.setup);
  app.post('/api/auth/logout', auth.logout);

  // --- Protegidas ---------------------------------------------------------
  app.use('/api', auth.guard);

  // Antes de cada petición, el registro de destinos se carga desde el viaje (así la validación y el clima los conocen).
  app.use('/api', async (_req, _res, next) => {
    try {
      registrarDestinos(await store.getDestinos());
      next();
    } catch (err) {
      next(err);
    }
  });

  // Agrega un lugar buscado (Nominatim) como destino del viaje. Devuelve su clave para usarla en los días.
  app.post('/api/destinos', rateLimit(60, 60_000), async (req, res) => {
    const parsed = destinoBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(422, 'Datos del destino inválidos', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    res.json(await store.addDestino(parsed.data));
  });

  // Cuenta propia y administración de accesos (compartir el viaje con otras personas)
  app.post('/api/auth/password', rateLimit(10, 60_000), auth.changePassword);
  app.get('/api/users', auth.listUsers);
  app.post('/api/users', auth.addUser);
  app.patch('/api/users/:id', auth.patchUser);
  app.delete('/api/users/:id', auth.removeUser);
  app.put('/api/sharing', auth.setSharing);

  app.get('/api/snapshot', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await store.snapshot(viajeDe(req)));
  });
  app.get('/api/events', async (req, res) => {
    // Sin conexiones largas en serverless: 204 le indica al cliente que no reconecte y use sondeo.
    if (config.serverless) {
      res.status(204).end();
      return;
    }
    hub.handler(req, res, await store.rev());
  });

  app.post('/api/ops', async (req, res) => {
    const { ops } = parseBody(opsBody, req.body);
    res.json({ rev: await store.applyOps(ops as Op[], viajeDe(req)) });
  });

  // REST por entidad (todas idempotentes: PUT hace upsert con id generado por el cliente).
  const routes: Array<[string, Op['entity']]> = [
    ['days', 'day'],
    ['activities', 'activity'],
    ['checklist', 'checklist'],
    ['reservations', 'reservation'],
    ['expenses', 'expense'],
  ];
  for (const [path, entity] of routes) {
    const apply = (action: Op['action']) => async (req: Request, res: Response) => {
      const rev = await store.applyOps([{ entity, action, id: String(req.params.id), data: req.body }], viajeDe(req));
      res.json({ rev });
    };
    app.put(`/api/${path}/:id`, apply('put'));
    app.patch(`/api/${path}/:id`, apply('patch'));
    app.delete(`/api/${path}/:id`, apply('delete'));
    app.get(`/api/${path}`, async (req, res) => {
      res.json(((await store.snapshot(viajeDe(req))) as unknown as Record<string, unknown>)[path]);
    });
  }
  // Archivos adjuntos de las reservas (capturas, pases de abordar, PDF). Máx. ~3 MB por archivo.
  const ATTACHMENT_MIME = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;
  app.put('/api/attachments/:id', express.json({ limit: '5mb' }), async (req, res) => {
    const id = String(req.params.id);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const reservationId = String(b.reservationId ?? '');
    const mime = String(b.mime ?? '');
    const data = String(b.data ?? '');
    const name = String(b.name ?? 'archivo').slice(0, 120) || 'archivo';
    const label = String(b.label ?? '').trim().slice(0, 60);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !reservationId) throw new HttpError(422, 'Datos inválidos');
    if (!ATTACHMENT_MIME.test(mime)) throw new HttpError(422, 'Solo se admiten imágenes y PDF');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 4_300_000) throw new HttpError(413, 'El archivo es demasiado grande (máx. 3 MB)');
    res.json({ rev: await store.putAttachment({ id, reservationId, name, label, mime, data }, viajeDe(req)) });
  });
  app.patch('/api/attachments/:id', express.json({ limit: '10kb' }), async (req, res) => {
    const label = String((req.body ?? {}).label ?? '').trim().slice(0, 60);
    res.json({ rev: await store.labelAttachment(String(req.params.id), label, viajeDe(req)) });
  });
  app.get('/api/attachments/:id', async (req, res) => {
    const file = await store.getAttachment(String(req.params.id), viajeDe(req));
    if (!file) throw new HttpError(404, 'Archivo no encontrado');
    // El contenido de un id nunca cambia: se puede guardar en caché para verlo sin conexión.
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // La CSP de la app (object-src 'none') impediría que Chrome muestre el PDF en su visor; el tipo ya está limitado a imágenes y PDF.
    res.removeHeader('Content-Security-Policy');
    res.send(Buffer.from(file.data, 'base64'));
  });
  app.delete('/api/attachments/:id', async (req, res) => {
    res.json({ rev: await store.deleteAttachment(String(req.params.id), viajeDe(req)) });
  });

  app.get('/api/trip', async (req, res) => res.json((await store.snapshot(viajeDe(req))).trip));
  app.patch('/api/trip', async (req, res) => {
    res.json({ rev: await store.applyOps([{ entity: 'trip', action: 'patch', id: 'trip', data: req.body }], viajeDe(req)) });
  });

  // --- Extras -------------------------------------------------------------
  app.get('/api/weather', async (req, res) => {
    const snap = await store.snapshot(viajeDe(req));
    const wanted: Partial<Record<City, string[]>> = {};
    for (const d of snap.days) (wanted[d.city] ??= []).push(d.date);
    res.json(await getWeather(wanted, snap.trip.timezone, req.query.refresh === '1'));
  });

  // Tiempos y rutas a pie / bicicleta / carro entre dos puntos (el avión se estima en el cliente).
  app.get('/api/routes', rateLimit(60, 60_000), async (req, res) => {
    const point = (v: unknown): [number, number] => {
      const [lat, lng] = String(v ?? '').split(',').map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new HttpError(422, 'Coordenadas inválidas');
      return [lat, lng];
    };
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json(await computeRoutes(point(req.query.from), point(req.query.to)));
  });
  // Recorrido a pie por varias paradas: /api/walk?pts=lat,lng;lat,lng;…
  app.get('/api/walk', rateLimit(40, 60_000), async (req, res) => {
    const pts = String(req.query.pts ?? '')
      .split(';')
      .filter(Boolean)
      .map((p) => p.split(',').map(Number) as [number, number]);
    if (pts.length < 2 || pts.length > 20 || pts.some(([la, lo]) => !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180)) {
      throw new HttpError(422, 'Entre 2 y 20 puntos válidos');
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    const w = await walk(pts);
    if (!w) throw new HttpError(404, 'No hay ruta a pie');
    res.json(w);
  });
  app.get('/api/geocode', rateLimit(30, 60_000), async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 3) throw new HttpError(422, 'Escribe al menos 3 letras');
    if (q.length > 120) throw new HttpError(422, 'La búsqueda es demasiado larga');
    const nearRaw = String(req.query.near ?? '');
    const near: City | undefined = destinoConocido(nearRaw) ? nearRaw : undefined;
    try {
      const [aLat, aLng] = String(req.query.around ?? '').split(',').map(Number);
      const around = Number.isFinite(aLat) && Number.isFinite(aLng) && Math.abs(aLat) <= 90 && Math.abs(aLng) <= 180 ? { lat: aLat, lng: aLng } : undefined;
      res.json(await geocode(q, near, around));
    } catch {
      throw new HttpError(502, 'No se pudo consultar el buscador de lugares');
    }
  });

  app.get('/api/export', async (req, res) => {
    const snap = await store.snapshot(viajeDe(req));
    res.setHeader('Content-Disposition', 'attachment; filename="viaje-respaldo.json"');
    res.json(snap);
  });
  app.post('/api/import', async (req, res) => {
    res.json({ rev: await store.importSnapshot(req.body, viajeDe(req)) });
  });
  app.post('/api/reset', async (req, res) => {
    res.json({ rev: await store.importSnapshot(buildSeed(), viajeDe(req)) });
  });

  app.get('/api/calendar.ics', async (req, res) => {
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="viaje.ics"');
    res.send(buildIcs(await store.snapshot(viajeDe(req))));
  });
  app.get('/api/calendar-link', (req, res) => {
    const base = `${req.protocol}://${req.get('host')}/api/calendar.ics`;
    res.json({ url: auth.enabled ? `${base}?key=${auth.icsKey(viajeDe(req))}` : base });
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

  // --- Frontend estático (producción) ---------------------------------------
  const indexHtml = join(config.webDir, 'index.html');
  if (existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(join(config.webDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(
      express.static(config.webDir, {
        setHeaders(res, file) {
          if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      // La app usa rutas con # (#/reservas, #/legal/…): cualquier otra dirección del servidor no existe.
      if (req.path !== '/') {
        res.status(404).type('html').send(paginaNoEncontrada());
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  // --- Errores ------------------------------------------------------------
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
    } else if (err instanceof ZodError) {
      res.status(422).json({ error: 'Datos inválidos', details: err.issues });
    } else if ((err as { type?: string })?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'JSON inválido' });
    } else if ((err as { status?: number })?.status === 404) {
      res.status(404).json({ error: 'No encontrado' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return { app, store, hub };
}

function parseBody<T>(schema: { parse(v: unknown): T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(422, 'Datos inválidos', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    throw err;
  }
}

