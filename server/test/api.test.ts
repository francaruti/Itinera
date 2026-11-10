import request from 'supertest';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { buildSeed } from '../src/seed';
import type { Snapshot } from '../../shared/types';
import { addDays, zonedToUtcMs } from '../../shared/time';

// Con TEST_DATABASE_URL (postgres://…) la misma suite corre contra Postgres; borra y resiembra esa base.
async function setup(env: Record<string, string> = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test', ...env }), dbPath: ':memory:', webDir: '/nonexistent' };
  const url = process.env.TEST_DATABASE_URL;
  const db = await openDb(url || ':memory:');
  const ctx = await createApp(db, config);
  if (url) await ctx.store.importSnapshot(buildSeed());
  return ctx;
}

// El ejemplo empieza dentro de una semana: las fechas y los IDs se leen del propio seed.
const SEED = buildSeed();
const DAY = SEED.days.map((d) => d.date);
/** ID de la primera actividad del día `i` (formato `seed-<fecha>-<n>`). */
const firstActivityId = (i: number) => `seed-${DAY[i]}-1`;

describe('API de viaje', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    ctx = await setup();
  });

  it('siembra un viaje de ejemplo sin reservas reales', async () => {
    const res = await request(ctx.app).get('/api/snapshot').expect(200);
    const snap = res.body as Snapshot;
    expect(snap.days).toHaveLength(DAY.length);
    expect(snap.trip).toMatchObject({ name: SEED.trip.name, startDate: DAY[0], endDate: DAY[DAY.length - 1] });
    expect(snap.activities).toHaveLength(SEED.activities.length);
    expect(snap.checklist.filter((c) => c.list === 'pending')).toHaveLength(SEED.checklist.filter((c) => c.list === 'pending').length);
    expect(snap.reservations).toHaveLength(SEED.reservations.length);
  });

  it('PUT es idempotente (creación offline con id del cliente)', async () => {
    const body = { dayDate: DAY[1], text: 'Dole Whip', time: '14:00', category: 'food', position: 5 };
    const r1 = await request(ctx.app).put('/api/activities/client-1').send(body).expect(200);
    const r2 = await request(ctx.app).put('/api/activities/client-1').send(body).expect(200);
    expect(r2.body.rev).toBeGreaterThan(r1.body.rev);
    const snap = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(snap.activities.filter((a) => a.id === 'client-1')).toHaveLength(1);
  });

  it('PATCH actualiza parcialmente y 404 si no existe', async () => {
    const target = firstActivityId(1);
    await request(ctx.app).patch(`/api/activities/${target}`).send({ done: true }).expect(200);
    const snap = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    const a = snap.activities.find((x) => x.id === target)!;
    expect(a.done).toBe(true);
    expect(a.text).toBe(SEED.activities.find((x) => x.id === target)!.text);
    await request(ctx.app).patch('/api/activities/nope').send({ done: true }).expect(404);
  });

  it('valida entradas (texto vacío, URL peligrosa, día inexistente)', async () => {
    await request(ctx.app).put('/api/activities/x').send({ dayDate: DAY[1], text: '  ' }).expect(422);
    await request(ctx.app)
      .put('/api/activities/x')
      .send({ dayDate: DAY[1], text: 'ok', url: 'javascript:alert(1)' })
      .expect(422);
    await request(ctx.app).put('/api/activities/x').send({ dayDate: '2030-01-01', text: 'ok' }).expect(422);
  });

  it('las operaciones por lote son atómicas', async () => {
    const before = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    await request(ctx.app)
      .post('/api/ops')
      .send({
        ops: [
          { entity: 'expense', action: 'put', id: 'e1', data: { date: DAY[0], description: 'Taxi', amount: 60 } },
          { entity: 'activity', action: 'patch', id: 'no-existe', data: { done: true } },
        ],
      })
      .expect(404);
    const after = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(after.expenses).toHaveLength(0);
    expect(after.rev).toBe(before.rev);
  });

  it('borrar un día elimina sus actividades (cascada)', async () => {
    await request(ctx.app).delete(`/api/days/${DAY[2]}`).expect(200);
    const snap = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(snap.days.find((d) => d.date === DAY[2])).toBeUndefined();
    expect(snap.activities.some((a) => a.dayDate === DAY[2])).toBe(false);
  });

  it('actualiza el presupuesto en USD y el viaje no guarda otra moneda', async () => {
    await request(ctx.app).patch('/api/trip').send({ budgetUsd: 3500 }).expect(200);
    await request(ctx.app).patch('/api/trip').send({ budgetUsd: -1 }).expect(422);
    const trip = (await request(ctx.app).get('/api/trip')).body;
    expect(trip.budgetUsd).toBe(3500);
    expect(trip).not.toHaveProperty('fxRate');
  });

  it('solo acepta gastos en USD: otra moneda se rechaza', async () => {
    await request(ctx.app).put('/api/expenses/e-cop').send({ date: DAY[0], description: 'Taxi', amount: 40000, currency: 'COP' }).expect(422);
    await request(ctx.app).put('/api/expenses/e-usd').send({ date: DAY[0], description: 'Taxi', amount: 12, currency: 'USD' }).expect(200);
  });

  it('exporta e importa un respaldo completo', async () => {
    await request(ctx.app).put('/api/expenses/e1').send({ date: DAY[0], description: 'Cena', amount: 42.5, category: 'food' }).expect(200);
    const exported = (await request(ctx.app).get('/api/export').expect(200)).body as Snapshot;
    await request(ctx.app).post('/api/reset').expect(200);
    expect(((await request(ctx.app).get('/api/snapshot')).body as Snapshot).expenses).toHaveLength(0);
    await request(ctx.app).post('/api/import').send(exported).expect(200);
    const restored = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(restored.expenses).toHaveLength(1);
    expect(restored.expenses[0].amount).toBe(42.5);
    await request(ctx.app).post('/api/import').send({ foo: 'bar' }).expect(422);
  });

  it('genera un calendario .ics válido', async () => {
    const res = await request(ctx.app).get('/api/calendar.ics').expect(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(res.text).toContain(`X-WR-CALNAME:${SEED.trip.name}`);
    expect(res.text).toContain('SUMMARY:Almuerzo cerca del alojamiento');
    // 13:00 en la zona horaria del viaje → UTC
    const utc = new Date(zonedToUtcMs(DAY[0], '13:00', SEED.trip.timezone)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    expect(res.text).toContain(`DTSTART:${utc}`);
    for (const line of res.text.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  it('acepta destinos nuevos: ciudades adicionales y días en otras fechas', async () => {
    const after = addDays(DAY[DAY.length - 1], 1);
    const later = addDays(after, 1);
    await request(ctx.app).put(`/api/days/${after}`).send({ city: 'washington', title: 'Capitolio y museos', travel: true }).expect(200);
    await request(ctx.app).patch(`/api/days/${after}`).send({ city: 'boston' }).expect(200);
    await request(ctx.app).put(`/api/days/${later}`).send({ city: 'atlantis' }).expect(422);
    const snap = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(snap.days.find((d) => d.date === after)?.city).toBe('boston');
    expect(snap.trip.endDate).toBe(after);
    // una actividad con ubicación elegida desde el buscador
    await request(ctx.app)
      .put('/api/activities/nuevo-1')
      .send({ dayDate: after, text: 'Parque de ejemplo', category: 'park', place: 'Parque de ejemplo', lat: 42.3601, lng: -71.0589, time: '12:30' })
      .expect(200);
  });

  it('valida el buscador de lugares sin llamar a la red', async () => {
    await request(ctx.app).get('/api/geocode?q=ab').expect(422);
    await request(ctx.app).get(`/api/geocode?q=${'x'.repeat(130)}`).expect(422);
  });

  it('responde JSON inválido con 400 y rutas inexistentes con 404', async () => {
    await request(ctx.app).post('/api/ops').set('Content-Type', 'application/json').send('{oops').expect(400);
    await request(ctx.app).get('/api/nada').expect(404);
  });

  it('emite eventos SSE al modificar datos', async () => {
    const server = ctx.app.listen(0);
    try {
      const port = (server.address() as { port: number }).port;
      const res = await fetch(`http://127.0.0.1:${port}/api/events`);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      const first = dec.decode((await reader.read()).value);
      const rev0 = Number(/"rev":(\d+)/.exec(first)?.[1]);

      await fetch(`http://127.0.0.1:${port}/api/activities/${firstActivityId(1)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true }),
      });
      const next = dec.decode((await reader.read()).value);
      expect(Number(/"rev":(\d+)/.exec(next)?.[1])).toBe(rev0 + 1);
      await reader.cancel();
    } finally {
      ctx.hub.close();
      server.close();
    }
  });
});

describe('Rutas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve distancia, duración y trazado por modo, y tolera modos sin ruta', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('routed-bike')) return new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 });
      const car = String(url).includes('routed-car');
      return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: car ? 2400 : 1175, duration: car ? 305 : 940, geometry: { coordinates: [[-73.9857, 40.7484], [-73.9772, 40.7527]] } }] }), { status: 200 });
    });
    const ctx = await setup();
    const res = await request(ctx.app).get('/api/routes?from=40.7484,-73.9857&to=40.7527,-73.9772').expect(200);
    expect(res.body.foot).toMatchObject({ distance: 1175, duration: 940, geometry: [[40.7484, -73.9857], [40.7527, -73.9772]] });
    expect(res.body.car.duration).toBe(305);
    expect(res.body.bike).toBeNull();
    expect(calls.some((u) => u.includes('-73.9857,40.7484;-73.9772,40.7527'))).toBe(true); // el servicio recibe lng,lat
    // la segunda petición idéntica sale de la caché
    const n = calls.length;
    await request(ctx.app).get('/api/routes?from=40.7484,-73.9857&to=40.7527,-73.9772').expect(200);
    expect(calls.length).toBe(n);
  });

  it('recorrido a pie por varias paradas: tramos y trazado', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 1702, duration: 1361, geometry: { coordinates: [[-73.98, 40.74], [-73.97, 40.75], [-73.96, 40.76]] }, legs: [{ distance: 1175, duration: 940 }, { distance: 527, duration: 421 }] }] }), { status: 200 }),
    );
    const ctx = await setup();
    const res = await request(ctx.app).get('/api/walk?pts=40.74,-73.98;40.75,-73.97;40.76,-73.96').expect(200);
    expect(res.body.legs).toEqual([{ distance: 1175, duration: 940 }, { distance: 527, duration: 421 }]);
    expect(res.body.geometry[0]).toEqual([40.74, -73.98]);
    await request(ctx.app).get('/api/walk?pts=40.74,-73.98').expect(422);
    await request(ctx.app).get('/api/walk?pts=abc;1,2').expect(422);
  });

  it('valida las coordenadas', async () => {
    const ctx = await setup();
    await request(ctx.app).get('/api/routes?from=abc&to=1,2').expect(422);
    await request(ctx.app).get('/api/routes?from=95,0&to=1,2').expect(422);
    await request(ctx.app).get('/api/routes?from=1,2').expect(422);
  });
});

describe('Reservas', () => {
  it('guarda aerolínea y número de vuelo por separado', async () => {
    const ctx = await setup();
    await request(ctx.app).patch('/api/reservations/seed-res-001').send({ provider: 'Aerolínea de prueba', flightNo: 'XX 100', confirmation: 'ABC123' }).expect(200);
    const r = ((await request(ctx.app).get('/api/snapshot')).body as Snapshot).reservations.find((x) => x.id === 'seed-res-001')!;
    expect(r).toMatchObject({ provider: 'Aerolínea de prueba', flightNo: 'XX 100', confirmation: 'ABC123' });
  });

  it('el ejemplo no trae reservas reales: sin proveedor, número de vuelo, código ni dirección', () => {
    expect(SEED.reservations.length).toBeGreaterThan(0);
    for (const r of SEED.reservations) expect(r).toMatchObject({ provider: '', flightNo: '', confirmation: '', address: '' });
  });
});

describe('Archivos adjuntos', () => {
  it('sube, lista, descarga y borra; se limpian al eliminar la reserva', async () => {
    const ctx = await setup();
    const snap0 = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    const res = snap0.reservations[0];
    const bytes = Buffer.from('%PDF-1.4 prueba');
    const put = await request(ctx.app)
      .put('/api/attachments/f1')
      .send({ reservationId: res.id, name: 'pase.pdf', mime: 'application/pdf', data: bytes.toString('base64') })
      .expect(200);
    expect(put.body.rev).toBeGreaterThan(snap0.rev);

    const snap = (await request(ctx.app).get('/api/snapshot')).body as Snapshot;
    expect(snap.attachments).toHaveLength(1);
    expect(snap.attachments[0]).toMatchObject({ id: 'f1', reservationId: res.id, name: 'pase.pdf', label: '', mime: 'application/pdf' });

    // varios archivos por reserva, cada uno con su nombre/persona
    await request(ctx.app).put('/api/attachments/f2').send({ reservationId: res.id, name: 'ana.pdf', label: ' Pase de Ana ', mime: 'application/pdf', data: bytes.toString('base64') }).expect(200);
    await request(ctx.app).patch('/api/attachments/f1').send({ label: 'Pase de Luis' }).expect(200);
    await request(ctx.app).patch('/api/attachments/nope').send({ label: 'x' }).expect(404);
    const two = ((await request(ctx.app).get('/api/snapshot')).body as Snapshot).attachments;
    expect(two.map((a) => a.label).sort()).toEqual(['Pase de Ana', 'Pase de Luis']);

    const file = await request(ctx.app).get('/api/attachments/f1').buffer(true).expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.headers['cache-control']).toContain('immutable');
    expect(file.headers['content-security-policy']).toBeUndefined();
    expect(Buffer.from(file.body).equals(bytes)).toBe(true);

    await request(ctx.app).delete(`/api/reservations/${res.id}`).expect(200);
    expect(((await request(ctx.app).get('/api/snapshot')).body as Snapshot).attachments).toHaveLength(0);
    await request(ctx.app).get('/api/attachments/f1').expect(404);
  });

  it('rechaza tipos no permitidos, base64 inválido y reservas inexistentes', async () => {
    const ctx = await setup();
    const res = ((await request(ctx.app).get('/api/snapshot')).body as Snapshot).reservations[0];
    const ok = Buffer.from('x').toString('base64');
    await request(ctx.app).put('/api/attachments/a').send({ reservationId: res.id, name: 'a.exe', mime: 'application/x-msdownload', data: ok }).expect(422);
    await request(ctx.app).put('/api/attachments/a').send({ reservationId: res.id, name: 'a.png', mime: 'image/png', data: '!!no-base64!!' }).expect(413);
    await request(ctx.app).put('/api/attachments/a').send({ reservationId: 'nope', name: 'a.png', mime: 'image/png', data: ok }).expect(422);
  });
});

describe('Cuentas y acceso', () => {
  // Cuentas de ejemplo (correos reservados para documentación); en producción las define SEED_USERS.
  const ADMIN = 'admin@example.com';
  const MEMBER = 'miembro@example.com';
  const USERS = { SEED_USERS: `${ADMIN}:admin,${MEMBER}:member` };

  it('protege la API: solo entran los correos autorizados y definen su contraseña con el código de invitación', async () => {
    const { app } = await setup({ ACCESS_CODE: 'secreto', ...USERS });
    await request(app).get('/api/snapshot').expect(401);
    await request(app).get('/api/health').expect(200);

    // correos no autorizados no pueden ni empezar
    await request(app).post('/api/auth/start').send({ email: 'intruso@example.com' }).expect(403);
    // primer ingreso del administrador: debe definir contraseña
    expect((await request(app).post('/api/auth/start').send({ email: ` ${ADMIN.toUpperCase()} ` }).expect(200)).body.state).toBe('setup');
    await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'cualquiera123' }).expect(401);
    await request(app).post('/api/auth/setup').send({ email: ADMIN, code: 'mal', password: 'clave-segura-1' }).expect(401);
    await request(app).post('/api/auth/setup').send({ email: ADMIN, code: 'secreto', password: 'corta' }).expect(422);
    await request(app).post('/api/auth/setup').send({ email: 'intruso@example.com', code: 'secreto', password: 'clave-segura-1' }).expect(403);

    const agent = request.agent(app);
    const ok = await agent.post('/api/auth/setup').send({ email: ADMIN, code: 'secreto', password: 'clave-segura-1' }).expect(200);
    expect(ok.body.user).toMatchObject({ email: ADMIN, role: 'admin' });
    await agent.get('/api/snapshot').expect(200);
    expect((await agent.get('/api/auth/status')).body).toMatchObject({ required: true, authenticated: true, user: { email: ADMIN, role: 'admin' } });
    // ya no se puede volver a «reclamar» la cuenta
    await request(app).post('/api/auth/setup').send({ email: ADMIN, code: 'secreto', password: 'otra-clave-123' }).expect(409);
    expect((await request(app).post('/api/auth/start').send({ email: ADMIN })).body.state).toBe('login');

    // inicio de sesión normal en otro dispositivo
    await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'incorrecta' }).expect(401);
    const other = request.agent(app);
    await other.post('/api/auth/login').send({ email: ADMIN, password: 'clave-segura-1' }).expect(200);
    await other.get('/api/snapshot').expect(200);
    const link = (await agent.get('/api/calendar-link').expect(200)).body.url as string;
    expect(link).toContain('?key=');
    await request(app).get(new URL(link).pathname + new URL(link).search).expect(200);
    await request(app).get('/api/calendar.ics?key=incorrecta').expect(401);

    // cerrar sesión
    await other.post('/api/auth/logout').expect(200);
    await other.get('/api/snapshot').expect(401);
  });

  it('el administrador comparte el viaje: agrega correos, desactiva el acceso compartido y restablece contraseñas', async () => {
    const { app } = await setup({ ACCESS_CODE: 'secreto', ...USERS });
    const admin = request.agent(app);
    await admin.post('/api/auth/setup').send({ email: ADMIN, code: 'secreto', password: 'clave-segura-1' }).expect(200);
    const member = request.agent(app);
    await member.post('/api/auth/setup').send({ email: MEMBER, code: 'secreto', password: 'clave-pareja-1' }).expect(200);

    // ve el mismo viaje
    const snapA = (await admin.get('/api/snapshot')).body as Snapshot;
    const snapM = (await member.get('/api/snapshot')).body as Snapshot;
    expect(snapM.rev).toBe(snapA.rev);
    await member.patch(`/api/activities/${firstActivityId(1)}`).send({ done: true }).expect(200);
    expect(((await admin.get('/api/snapshot')).body as Snapshot).activities.find((a) => a.id === firstActivityId(1))?.done).toBe(true);

    // solo el administrador gestiona accesos
    await member.get('/api/users').expect(403);
    await member.post('/api/users').send({ email: 'otra@example.com' }).expect(403);
    const list = await admin.get('/api/users').expect(200);
    expect(list.body.sharing).toBe(true);
    expect(list.body.users.map((u: { email: string }) => u.email).sort()).toEqual([ADMIN, MEMBER].sort());

    const added = await admin.post('/api/users').send({ email: ' Amiga@Example.com ' }).expect(200);
    expect(added.body.users.find((u: { email: string }) => u.email === 'amiga@example.com')).toMatchObject({ role: 'member', hasPassword: false });
    await admin.post('/api/users').send({ email: 'amiga@example.com' }).expect(409);
    await admin.post('/api/users').send({ email: 'no-es-correo' }).expect(422);
    expect((await request(app).post('/api/auth/start').send({ email: 'amiga@example.com' })).body.state).toBe('setup');

    // desactivar el acceso compartido bloquea a los miembros, no al administrador
    await admin.put('/api/sharing').send({ enabled: false }).expect(200);
    await member.get('/api/snapshot').expect(403);
    await admin.get('/api/snapshot').expect(200);
    await request(app).post('/api/auth/start').send({ email: MEMBER }).expect(403);
    await admin.put('/api/sharing').send({ enabled: true }).expect(200);
    await member.get('/api/snapshot').expect(200);

    // restablecer contraseña: la sesión anterior deja de valer y debe definir otra
    const memberId = (await admin.get('/api/users')).body.users.find((u: { email: string }) => u.email === MEMBER).id as string;
    await admin.patch(`/api/users/${memberId}`).send({ resetPassword: true }).expect(200);
    await member.get('/api/snapshot').expect(401);
    expect((await request(app).post('/api/auth/start').send({ email: MEMBER })).body.state).toBe('setup');

    // protecciones
    const adminId = (await admin.get('/api/users')).body.users.find((u: { email: string }) => u.email === ADMIN).id as string;
    await admin.delete(`/api/users/${adminId}`).expect(409);
    await admin.patch(`/api/users/${adminId}`).send({ role: 'member' }).expect(409);
    await admin.delete(`/api/users/${memberId}`).expect(200);
    await request(app).post('/api/auth/start').send({ email: MEMBER }).expect(403);
  });

  it('cambiar la contraseña exige la actual', async () => {
    const { app } = await setup({ ACCESS_CODE: 'secreto', ...USERS });
    const admin = request.agent(app);
    await admin.post('/api/auth/setup').send({ email: ADMIN, code: 'secreto', password: 'clave-segura-1' }).expect(200);
    await admin.post('/api/auth/password').send({ current: 'mal', next: 'nueva-clave-123' }).expect(401);
    await admin.post('/api/auth/password').send({ current: 'clave-segura-1', next: 'corta' }).expect(422);
    await admin.post('/api/auth/password').send({ current: 'clave-segura-1', next: 'nueva-clave-123' }).expect(200);
    await admin.get('/api/snapshot').expect(200); // la sesión actual se renueva
    await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'clave-segura-1' }).expect(401);
    await request(app).post('/api/auth/login').send({ email: ADMIN, password: 'nueva-clave-123' }).expect(200);
  });

  it('sin código de acceso configurado no hay cuentas (modo local)', async () => {
    const { app } = await setup();
    await request(app).get('/api/snapshot').expect(200);
    expect((await request(app).get('/api/auth/status')).body).toMatchObject({ required: false, authenticated: true });
    await request(app).get('/api/users').expect(409);
  });
});

describe('Configuración', () => {
  it('ignora variables vacías (como las de .env.example) y usa los valores por defecto', () => {
    const cfg = loadConfig({ PORT: '', DB_PATH: '', ACCESS_CODE: '', SEED_USERS: '' });
    expect(cfg.port).toBe(3001);
    expect(cfg.dbPath).toBe(resolve('data/trip.db'));
    expect(cfg.accessCode).toBe('');
    expect(loadConfig({ PORT: '3000' }).port).toBe(3000);
  });
});
