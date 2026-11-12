import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { buildSeed } from '../src/seed';
import type { Snapshot } from '../../shared/types';

// Correos de ejemplo reservados para pruebas.
const ANA = 'ana@example.com';
const BRUNO = 'bruno@example.com';
const CLAVE = 'clave-segura-1';
const SEED = buildSeed();

/** Dos viajes: el 1 (ejemplo, de Ana) y el 2 (de Bruno, creado como si fuera una compra). */
async function arranque(extra: Record<string, string> = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test', ACCESS_CODE: 'secreto', SEED_USERS: `${ANA}:admin`, ...extra }), dbPath: ':memory:', webDir: '/nonexistent' };
  const db = await openDb(':memory:');
  const ctx = await createApp(db, config);
  const { store } = ctx;
  const ana = (await store.findUserByEmail(ANA))!;
  await store.updateUser(ana.id, { passwordHash: await hashPassword(CLAVE) });
  const viaje = await store.createTrip();
  await store.createUser({ id: 'bruno', email: BRUNO, role: 'admin', tripId: viaje });
  await store.updateUser('bruno', { passwordHash: await hashPassword(CLAVE) });
  return { ...ctx, anaId: ana.id, viaje };
}

async function entrar(app: Awaited<ReturnType<typeof arranque>>['app'], email: string) {
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send({ email, password: CLAVE }).expect(200);
  return agente;
}

describe('cuentas por viaje', () => {
  it('cada cuenta ve solo su viaje', async () => {
    const { app, viaje } = await arranque();
    const ana = await entrar(app, ANA);
    const bruno = await entrar(app, BRUNO);
    const snapAna = (await ana.get('/api/snapshot').expect(200)).body as Snapshot;
    const snapBruno = (await bruno.get('/api/snapshot').expect(200)).body as Snapshot;
    expect(snapAna.days).toHaveLength(SEED.days.length);
    expect(snapBruno.days).toHaveLength(0);
    expect(snapBruno.trip.name).toBe('Mi viaje');
    expect(viaje).toBe(2);
  });

  it('cambiar el viaje de una cuenta no cambia el de la otra', async () => {
    const { app } = await arranque();
    const ana = await entrar(app, ANA);
    const bruno = await entrar(app, BRUNO);
    await bruno.patch('/api/trip').send({ name: 'Venecia' }).expect(200);
    expect(((await ana.get('/api/trip')).body as { name: string }).name).toBe(SEED.trip.name);
    expect(((await bruno.get('/api/trip')).body as { name: string }).name).toBe('Venecia');
  });

  it('quien administra un viaje no ve ni cambia las cuentas de otro', async () => {
    const { app, anaId } = await arranque();
    const bruno = await entrar(app, BRUNO);
    const lista = (await bruno.get('/api/users').expect(200)).body.users as Array<{ email: string }>;
    expect(lista.map((u) => u.email)).toEqual([BRUNO]);
    await bruno.patch(`/api/users/${anaId}`).send({ role: 'member' }).expect(404);
    await bruno.delete(`/api/users/${anaId}`).expect(404);
    const ana = await entrar(app, ANA);
    expect((await ana.get('/api/users')).body.users).toHaveLength(1);
  });

  it('una cuenta nueva de un viaje entra solo a ese viaje', async () => {
    const { app, store, viaje } = await arranque();
    await store.createUser({ id: 'carla', email: 'carla@example.com', role: 'member', tripId: viaje });
    await store.updateUser('carla', { passwordHash: await hashPassword(CLAVE) });
    const carla = await entrar(app, 'carla@example.com');
    expect(((await carla.get('/api/snapshot')).body as Snapshot).days).toHaveLength(0);
  });

  it('el interruptor de acceso compartido es de cada viaje', async () => {
    const { app, store, viaje } = await arranque();
    await store.createUser({ id: 'diego', email: 'diego@example.com', role: 'member', tripId: 1 });
    await store.updateUser('diego', { passwordHash: await hashPassword(CLAVE) });
    await store.createUser({ id: 'elena', email: 'elena@example.com', role: 'member', tripId: viaje });
    await store.updateUser('elena', { passwordHash: await hashPassword(CLAVE) });
    const bruno = await entrar(app, BRUNO);
    await bruno.put('/api/sharing').send({ enabled: false }).expect(200);
    expect(await store.getMeta(`sharing:${viaje}`)).toBe('0');
    await request(app).post('/api/auth/login').send({ email: 'elena@example.com', password: CLAVE }).expect(403);
    await request(app).post('/api/auth/login').send({ email: 'diego@example.com', password: CLAVE }).expect(200);
  });

  it('la clave del calendario de un viaje no muestra el otro', async () => {
    const { app } = await arranque();
    const ana = await entrar(app, ANA);
    const bruno = await entrar(app, BRUNO);
    const aUrl = new URL((await ana.get('/api/calendar-link').expect(200)).body.url as string);
    const bUrl = new URL((await bruno.get('/api/calendar-link').expect(200)).body.url as string);
    const aIcs = (await request(app).get(aUrl.pathname + aUrl.search).expect(200)).text;
    const bIcs = (await request(app).get(bUrl.pathname + bUrl.search).expect(200)).text;
    expect(aIcs).toContain('BEGIN:VEVENT');
    expect(bIcs).not.toContain('BEGIN:VEVENT');
    await request(app).get(bUrl.pathname + '?key=2.000000000000000000000000').expect(401);
  });
});
