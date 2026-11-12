import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SQLITE_MIGRATIONS } from '../src/db';

/** Base tal como queda con la versión 6 (la que tiene la app hoy). */
function baseVersion6(): DatabaseSync {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = OFF');
  for (let v = 0; v < 6; v++) raw.exec(SQLITE_MIGRATIONS[v]);
  raw.exec('PRAGMA user_version = 6');
  return raw;
}

describe('migración 7: días y actividades por viaje', () => {
  it('conserva los días y actividades que ya existían', () => {
    const raw = baseVersion6();
    raw.exec(`INSERT INTO days (date, city, updated_at) VALUES ('2027-04-10', 'roma', 1)`);
    raw.exec(`INSERT INTO activities (id, day_date, text, updated_at) VALUES ('a1', '2027-04-10', 'Coliseo', 1)`);

    raw.exec(SQLITE_MIGRATIONS[6]);

    expect(raw.prepare('SELECT trip_id, date, city FROM days').all()).toEqual([
      { trip_id: 1, date: '2027-04-10', city: 'roma' },
    ]);
    expect(raw.prepare('SELECT id, trip_id, day_date, text FROM activities').all()).toEqual([
      { id: 'a1', trip_id: 1, day_date: '2027-04-10', text: 'Coliseo' },
    ]);
  });

  it('permite dos viajes con el mismo día y, al borrar uno, solo se van sus actividades', () => {
    const raw = baseVersion6();
    raw.exec(SQLITE_MIGRATIONS[6]);
    raw.exec('PRAGMA foreign_keys = ON');

    raw.exec(
      `INSERT INTO days (trip_id, date, city, updated_at) VALUES (1, '2027-04-10', 'roma', 1), (2, '2027-04-10', 'venecia', 1)`,
    );
    raw.exec(
      `INSERT INTO activities (id, trip_id, day_date, text, updated_at) VALUES ('a1', 1, '2027-04-10', 'Coliseo', 1), ('b1', 2, '2027-04-10', 'Góndola', 1)`,
    );
    expect(raw.prepare('SELECT COUNT(*) AS n FROM days').get()).toEqual({ n: 2 });

    raw.exec('DELETE FROM days WHERE trip_id = 2');

    expect(raw.prepare('SELECT id FROM activities ORDER BY id').all()).toEqual([{ id: 'a1' }]);
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
