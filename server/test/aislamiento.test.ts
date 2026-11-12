import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db';
import { createStore } from '../src/store';

async function almacenConDosViajes() {
  const db = await openDb(':memory:');
  await db.run(
    `INSERT INTO trip(id, name, timezone, updated_at) VALUES (1, 'Miami', 'America/New_York', 1), (2, 'Venecia', 'Europe/Rome', 1)`,
  );
  return { db, store: createStore(db) };
}

describe('aislamiento entre viajes', () => {
  it('dos viajes pueden tener el mismo día y cada uno ve solo el suyo', async () => {
    const { store } = await almacenConDosViajes();
    await store.applyOps([{ entity: 'day', action: 'put', id: '2027-04-10', data: { city: 'miami' } }], 1);
    await store.applyOps([{ entity: 'day', action: 'put', id: '2027-04-10', data: { city: 'orlando' } }], 2);

    expect((await store.snapshot(1)).days.map((d) => d.city)).toEqual(['miami']);
    expect((await store.snapshot(2)).days.map((d) => d.city)).toEqual(['orlando']);
  });

  it('un viaje no puede modificar un día de otro viaje', async () => {
    const { store } = await almacenConDosViajes();
    await store.applyOps([{ entity: 'day', action: 'put', id: '2027-04-10', data: { city: 'miami' } }], 1);

    await expect(
      store.applyOps([{ entity: 'day', action: 'patch', id: '2027-04-10', data: { city: 'orlando' } }], 2),
    ).rejects.toThrow();
    expect((await store.snapshot(1)).days.map((d) => d.city)).toEqual(['miami']);
  });

  it('borrar un día desde otro viaje no toca el del primero', async () => {
    const { store } = await almacenConDosViajes();
    await store.applyOps([{ entity: 'day', action: 'put', id: '2027-04-10', data: { city: 'miami' } }], 1);

    await store.applyOps([{ entity: 'day', action: 'delete', id: '2027-04-10' }], 2);

    expect((await store.snapshot(1)).days.map((d) => d.city)).toEqual(['miami']);
  });
});
