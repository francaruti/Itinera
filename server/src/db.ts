import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

export type Row = Record<string, unknown>;

export interface Queryable {
  all(sql: string, params?: unknown[]): Promise<Row[]>;
  get(sql: string, params?: unknown[]): Promise<Row | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}
export interface Db extends Queryable {
  dialect: 'sqlite' | 'postgres';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/* ---------------------------------- SQLite ---------------------------------- */

export const SQLITE_MIGRATIONS: string[] = [
  /* v1 */ `
  CREATE TABLE trip (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL,
    budget_usd REAL NOT NULL DEFAULT 0,
    fx_rate REAL NOT NULL DEFAULT 4000,
    travelers TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE days (
    date TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    travel INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    day_date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE ON UPDATE CASCADE,
    position REAL NOT NULL DEFAULT 0,
    time TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'other',
    place TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    cost REAL,
    booking TEXT NOT NULL DEFAULT 'none',
    url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_activities_day ON activities(day_date, position);
  CREATE TABLE checklist (
    id TEXT PRIMARY KEY,
    list TEXT NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '',
    position REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT '',
    confirmation TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT 'ny',
    address TEXT NOT NULL DEFAULT '',
    amount REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'todo',
    paid INTEGER NOT NULL DEFAULT 0,
    url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    position REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    paid_by TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  /* v2: archivos adjuntos de las reservas (capturas y pases de abordar) */ `
  CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    reservation_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_attachments_res ON attachments(reservation_id);
  `,
  /* v3: nombre/persona de cada archivo adjunto */ `
  ALTER TABLE attachments ADD COLUMN label TEXT NOT NULL DEFAULT '';
  `,
  /* v4: cuentas de usuario (lista de correos autorizados) */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',
    password_hash TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_login INTEGER
  );
  `,
  /* v5: número de vuelo en las reservas */ `
  ALTER TABLE reservations ADD COLUMN flight_no TEXT NOT NULL DEFAULT '';
  `,
  /* v6: cada registro indica a qué viaje pertenece (por ahora, todo es del viaje 1) */ `
  ALTER TABLE days ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE activities ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE checklist ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE reservations ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE expenses ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE attachments ADD COLUMN trip_id INTEGER NOT NULL DEFAULT 1;
  `,
  /* v7: días y actividades se identifican también por viaje (dos viajes pueden tener la misma fecha).
     SQLite no cambia claves con ALTER, así que se reconstruyen las dos tablas con sus datos. */ `
  CREATE TABLE days_nuevo (
    trip_id INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    city TEXT NOT NULL,
    travel INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (trip_id, date)
  );
  INSERT INTO days_nuevo (trip_id, date, city, travel, title, notes, updated_at)
    SELECT trip_id, date, city, travel, title, notes, updated_at FROM days;
  CREATE TABLE activities_nuevo (
    id TEXT PRIMARY KEY,
    trip_id INTEGER NOT NULL DEFAULT 1,
    day_date TEXT NOT NULL,
    position REAL NOT NULL DEFAULT 0,
    time TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'other',
    place TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    cost REAL,
    booking TEXT NOT NULL DEFAULT 'none',
    url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (trip_id, day_date) REFERENCES days_nuevo(trip_id, date) ON DELETE CASCADE ON UPDATE CASCADE
  );
  INSERT INTO activities_nuevo (id, trip_id, day_date, position, time, text, done, category, place, lat, lng, cost, booking, url, notes, updated_at)
    SELECT id, trip_id, day_date, position, time, text, done, category, place, lat, lng, cost, booking, url, notes, updated_at FROM activities;
  DROP TABLE activities;
  DROP TABLE days;
  ALTER TABLE days_nuevo RENAME TO days;
  ALTER TABLE activities_nuevo RENAME TO activities;
  CREATE INDEX idx_activities_day ON activities(trip_id, day_date, position);
  `,
];

function openSqlite(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const version = (raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  // Mientras se migra, las claves foráneas están apagadas: al reconstruir una tabla no deben borrarse filas en cascada.
  raw.exec('PRAGMA foreign_keys = OFF');
  try {
    for (let v = version; v < SQLITE_MIGRATIONS.length; v++) {
      raw.exec('BEGIN');
      try {
        raw.exec(SQLITE_MIGRATIONS[v]);
        // Ninguna migración puede dejar referencias rotas: si la hay, se revierte ese paso completo.
        if (raw.prepare('PRAGMA foreign_key_check').all().length > 0) {
          throw new Error(`La migración ${v + 1} dejó referencias rotas entre tablas`);
        }
        raw.exec(`PRAGMA user_version = ${v + 1}`);
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    }
  } finally {
    raw.exec('PRAGMA foreign_keys = ON');
  }

  const q: Queryable = {
    async all(sql, params = []) {
      return raw.prepare(sql).all(...(params as SQLInputValue[])) as Row[];
    },
    async get(sql, params = []) {
      return raw.prepare(sql).get(...(params as SQLInputValue[])) as Row | undefined;
    },
    async run(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as SQLInputValue[]));
      return { changes: Number(r.changes) };
    },
  };

  // Una sola conexión: las transacciones se serializan para que no se mezclen entre peticiones.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    dialect: 'sqlite',
    ...q,
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const run = async () => {
        raw.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(q);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          raw.exec('ROLLBACK');
          throw err;
        }
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
    async close() {
      raw.close();
    },
  };
}

/* --------------------------------- Postgres --------------------------------- */

/** Convierte placeholders `?` a `$1, $2…` (el SQL de la app no contiene `?` en literales). */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function openPostgres(url: string): Promise<Db> {
  const serverless = !!process.env.VERCEL;
  const pool = new pg.Pool({
    connectionString: url,
    max: serverless ? 4 : 5,
    idleTimeoutMillis: serverless ? 5000 : 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });

  const wrap = (client: pg.Pool | pg.PoolClient): Queryable => ({
    async all(sql, params = []) {
      return (await client.query(toPg(sql), params)).rows as Row[];
    },
    async get(sql, params = []) {
      return (await client.query(toPg(sql), params)).rows[0] as Row | undefined;
    },
    async run(sql, params = []) {
      return { changes: (await client.query(toPg(sql), params)).rowCount ?? 0 };
    },
  });
  const base = wrap(pool);

  const db: Db = {
    dialect: 'postgres',
    ...base,
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN; SELECT pg_advisory_xact_lock(7243901)');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };

  const exists = await db.get(`SELECT to_regclass('viaje.trip') AS t`).catch(() => undefined);
  if (!exists?.t) {
    await pool.end();
    throw new Error('Faltan las tablas del esquema "viaje". Aplica server/sql/postgres.sql en la base de datos.');
  }
  return db;
}

/** `target` es una ruta de archivo SQLite, `:memory:` o una URL `postgres://…`. */
export async function openDb(target: string): Promise<Db> {
  return /^postgres(ql)?:\/\//i.test(target) ? openPostgres(target) : openSqlite(target);
}
