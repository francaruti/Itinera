import { ZodError } from 'zod';
import type { Attachment, CityMeta, Op, Snapshot, Trip, UserRole } from '../../shared/types';
import { cityMeta, destinoConocido, registrarDestinos } from '../../shared/constants';
import type { Db, Queryable, Row } from './db';
import { HttpError } from './errors';
import { SPECS, TRIP_COLS, destinosMap, importSchema, tripPatch, type Col, type Spec } from './model';

const q = (id: string) => `"${id}"`;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Clave base de un lugar: su nombre en minúsculas, sin acentos ni espacios (p. ej. «Roma» → `roma`). */
function claveBase(name: string): string {
  return sinAcentos(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'destino';
}

/** Código corto de tres letras (p. ej. «Roma» → `ROM`). */
function codigoCorto(name: string): string {
  return sinAcentos(name).replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'DST';
}

/**
 * Clave para un lugar nuevo. Si la clave ya existe para el mismo lugar (coordenadas cercanas), la reutiliza;
 * si la ocupa otro lugar, añade un número (`roma-2`).
 */
function claveLibre(name: string, lat: number, lng: number): { clave: string; existente: boolean } {
  const base = claveBase(name);
  for (let i = 1; i < 100; i++) {
    const clave = i === 1 ? base : `${base}-${i}`;
    if (destinoConocido(clave)) {
      const m = cityMeta(clave);
      if (Math.abs(m.lat - lat) < 0.05 && Math.abs(m.lng - lng) < 0.05) return { clave, existente: true };
      continue;
    }
    return { clave, existente: false };
  }
  throw new HttpError(422, 'No se pudo crear un identificador para ese lugar');
}

function toDb(col: Col, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  switch (col.type) {
    case 'bool':
      return value ? 1 : 0;
    case 'json':
      return JSON.stringify(value);
    default:
      return value;
  }
}

function fromDb(col: Col, value: unknown): unknown {
  switch (col.type) {
    case 'bool':
      return Number(value) === 1;
    case 'json':
      return JSON.parse(String(value ?? '[]'));
    default:
      return value;
  }
}

function mapRow(cols: Col[], row: Row, pk?: { key: string; col: string }): Row {
  const out: Row = {};
  if (pk) out[pk.key] = row[pk.col];
  for (const col of cols) out[col.key] = fromDb(col, row[col.col]);
  return out;
}

function parse<T extends { parse(v: unknown): unknown }>(schema: T, data: unknown): Record<string, unknown> {
  try {
    return schema.parse(data) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(422, 'Datos inválidos', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    throw err;
  }
}

export interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: number;
  lastLogin: number | null;
}

export interface Store {
  listUsers(): Promise<UserRow[]>;
  getUser(id: string): Promise<UserRow | null>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  createUser(u: { id: string; email: string; role: UserRole }): Promise<void>;
  updateUser(id: string, patch: { role?: UserRole; passwordHash?: string; lastLogin?: number }): Promise<void>;
  deleteUser(id: string): Promise<void>;

  snapshot(): Promise<Snapshot>;
  rev(): Promise<number>;
  applyOps(ops: Op[]): Promise<number>;
  importSnapshot(data: unknown): Promise<number>;
  isEmpty(): Promise<boolean>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  getDestinos(): Promise<Record<string, CityMeta>>;
  addDestino(input: { name: string; lat: number; lng: number }): Promise<{ key: string; meta: CityMeta; rev: number }>;
  putAttachment(a: { id: string; reservationId: string; name: string; label?: string; mime: string; data: string }): Promise<number>;
  labelAttachment(id: string, label: string): Promise<number>;
  getAttachment(id: string): Promise<{ name: string; mime: string; data: string } | null>;
  deleteAttachment(id: string): Promise<number>;
}

const toUser = (r: Row): UserRow => ({
  id: String(r.id),
  email: String(r.email),
  role: (r.role === 'admin' ? 'admin' : 'member') as UserRole,
  passwordHash: String(r.password_hash ?? ''),
  createdAt: Number(r.created_at),
  lastLogin: r.last_login == null ? null : Number(r.last_login),
});

export function createStore(db: Db, onChange?: (rev: number) => void): Store {
  const now = () => Date.now();
  /** Nombre de tabla con esquema según el motor (Postgres usa el esquema aislado "viaje"). */
  const t = (name: string) => (db.dialect === 'postgres' ? `viaje.${q(name)}` : q(name));

  const getMeta = async (key: string, tx: Queryable = db) => {
    const row = await tx.get(`SELECT value FROM ${t('meta')} WHERE key = ?`, [key]);
    return row ? String(row.value) : null;
  };
  const setMeta = async (key: string, value: string, tx: Queryable = db) => {
    await tx.run(
      `INSERT INTO ${t('meta')}(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  };
  /** Destinos agregados por el viaje (se guardan como JSON en la tabla meta; no necesitan tabla propia). */
  const getDestinos = async (tx: Queryable = db): Promise<Record<string, CityMeta>> => {
    const raw = await getMeta('destinos', tx);
    if (!raw) return {};
    try {
      return destinosMap.parse(JSON.parse(raw)) as Record<string, CityMeta>;
    } catch {
      return {};
    }
  };
  const rev = async (tx: Queryable = db) => Number((await getMeta('rev', tx)) ?? 0);
  const bump = async (tx: Queryable) => {
    const row = await tx.get(
      `INSERT INTO ${t('meta')}(key, value) VALUES('rev', '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(${t('meta')}.value AS INTEGER) + 1
       RETURNING value`,
    );
    return Number(row?.value ?? 0);
  };

  async function wrapDb<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === '23503' || /FOREIGN KEY|constraint failed/i.test(e.message ?? '')) {
        throw new HttpError(422, 'Referencia inválida (¿el día existe?)');
      }
      throw err;
    }
  }

  async function put(tx: Queryable, spec: Spec, id: string, input: unknown) {
    const data = parse(spec.full, input);
    const columns = [spec.pk, ...spec.cols.map((c) => c.col), 'updated_at'];
    const values = [id, ...spec.cols.map((c) => toDb(c, data[c.key])), now()];
    const updates = columns.slice(1).map((col) => `${q(col)} = excluded.${q(col)}`);
    await wrapDb(() =>
      tx.run(
        `INSERT INTO ${t(spec.table)} (${columns.map(q).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
         ON CONFLICT(${q(spec.pk)}) DO UPDATE SET ${updates.join(', ')}`,
        values,
      ),
    );
  }

  /** Inserción masiva (usada al importar): valida cada fila y agrupa en sentencias de varias filas. */
  async function putMany(tx: Queryable, spec: Spec, items: Array<Record<string, unknown>>) {
    const byId = new Map<string, Record<string, unknown>>();
    for (const item of items) {
      const id = String(item[spec.pk]);
      byId.set(id, parse(spec.full, item));
    }
    const columns = [spec.pk, ...spec.cols.map((c) => c.col), 'updated_at'];
    const rowSql = `(${columns.map(() => '?').join(', ')})`;
    const entries = [...byId.entries()];
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      const values = chunk.flatMap(([id, data]) => [id, ...spec.cols.map((c) => toDb(c, data[c.key])), now()]);
      await wrapDb(() =>
        tx.run(`INSERT INTO ${t(spec.table)} (${columns.map(q).join(', ')}) VALUES ${chunk.map(() => rowSql).join(', ')}`, values),
      );
    }
  }

  async function patch(tx: Queryable, spec: Spec, id: string, input: unknown) {
    const data = parse(spec.patch, input);
    const cols = spec.cols.filter((c) => data[c.key] !== undefined);
    if (cols.length === 0) return;
    const sets = [...cols.map((c) => `${q(c.col)} = ?`), 'updated_at = ?'];
    const values = [...cols.map((c) => toDb(c, data[c.key])), now(), id];
    const res = await wrapDb(() => tx.run(`UPDATE ${t(spec.table)} SET ${sets.join(', ')} WHERE ${q(spec.pk)} = ?`, values));
    if (res.changes === 0) throw new HttpError(404, `${spec.entity} ${id} no existe`);
  }

  async function remove(tx: Queryable, spec: Spec, id: string) {
    await tx.run(`DELETE FROM ${t(spec.table)} WHERE ${q(spec.pk)} = ?`, [id]);
  }

  async function patchTrip(tx: Queryable, input: unknown) {
    const data = parse(tripPatch, input);
    const cols = TRIP_COLS.filter((c) => data[c.key] !== undefined);
    if (cols.length === 0) return;
    const sets = [...cols.map((c) => `${q(c.col)} = ?`), 'updated_at = ?'];
    await tx.run(`UPDATE ${t('trip')} SET ${sets.join(', ')} WHERE id = 1`, [...cols.map((c) => toDb(c, data[c.key])), now()]);
  }

  async function applyOp(tx: Queryable, op: Op) {
    if (op.entity === 'trip') {
      if (op.action !== 'patch') throw new HttpError(422, 'El viaje solo admite patch');
      return patchTrip(tx, op.data ?? {});
    }
    const spec = SPECS[op.entity];
    switch (op.action) {
      case 'put':
        return put(tx, spec, op.id, op.data ?? {});
      case 'patch':
        return patch(tx, spec, op.id, op.data ?? {});
      case 'delete':
        if (op.entity === 'reservation') await tx.run(`DELETE FROM ${t('attachments')} WHERE reservation_id = ?`, [op.id]);
        return remove(tx, spec, op.id);
    }
  }

  async function snapshot(): Promise<Snapshot> {
    const list = async (spec: Spec) =>
      (await db.all(`SELECT * FROM ${t(spec.table)} ORDER BY ${spec.order}`)).map((r) =>
        mapRow(spec.cols, r, { key: spec.pk === 'date' ? 'date' : 'id', col: spec.pk }),
      );
    const attachmentRows = await db.all(`SELECT id, reservation_id, name, label, mime, size, created_at FROM ${t('attachments')} ORDER BY created_at, id`);
    const attachments: Attachment[] = attachmentRows.map((r) => ({
      id: String(r.id),
      reservationId: String(r.reservation_id),
      name: String(r.name),
      label: String(r.label ?? ''),
      mime: String(r.mime),
      size: Number(r.size),
      createdAt: Number(r.created_at),
    }));
    const destinos = await getDestinos();
    const [tripRow, currentRev, days0, activities, checklist, reservations, expenses] = await Promise.all([
      db.get(`SELECT * FROM ${t('trip')} WHERE id = 1`) as Promise<Row>,
      rev(),
      list(SPECS.day),
      list(SPECS.activity),
      list(SPECS.checklist),
      list(SPECS.reservation),
      list(SPECS.expense),
    ]);
    const days = days0 as unknown as Snapshot['days'];
    const trip = {
      ...mapRow(TRIP_COLS, tripRow),
      startDate: days[0]?.date ?? '',
      endDate: days[days.length - 1]?.date ?? '',
    } as unknown as Trip;
    return {
      rev: currentRev,
      trip,
      days,
      activities: activities as unknown as Snapshot['activities'],
      checklist: checklist as unknown as Snapshot['checklist'],
      reservations: reservations as unknown as Snapshot['reservations'],
      expenses: expenses as unknown as Snapshot['expenses'],
      attachments,
      destinos,
    };
  }

  return {
    snapshot,
    rev: () => rev(),
    getMeta: (key) => getMeta(key),
    setMeta: (key, value) => setMeta(key, value),
    getDestinos: () => getDestinos(),
    async addDestino(input) {
      const result = await db.transaction(async (tx) => {
        const { clave, existente } = claveLibre(input.name, input.lat, input.lng);
        if (!existente) {
          const meta: CityMeta = { name: input.name, short: codigoCorto(input.name), lat: input.lat, lng: input.lng, region: 'ne' };
          const actuales = await getDestinos(tx);
          await setMeta('destinos', JSON.stringify({ ...actuales, [clave]: meta }), tx);
          registrarDestinos({ [clave]: meta });
        }
        return { key: clave, meta: cityMeta(clave), rev: await bump(tx) };
      });
      onChange?.(result.rev);
      return result;
    },
    async listUsers() {
      return (await db.all(`SELECT * FROM ${t('users')} ORDER BY created_at, email`)).map(toUser);
    },
    async getUser(id) {
      const r = await db.get(`SELECT * FROM ${t('users')} WHERE id = ?`, [id]);
      return r ? toUser(r) : null;
    },
    async findUserByEmail(email) {
      const r = await db.get(`SELECT * FROM ${t('users')} WHERE email = ?`, [email]);
      return r ? toUser(r) : null;
    },
    async createUser(u) {
      await db.run(`INSERT INTO ${t('users')}(id, email, role, password_hash, created_at) VALUES(?, ?, ?, '', ?)`, [u.id, u.email, u.role, now()]);
    },
    async updateUser(id, patch) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (patch.role !== undefined) { sets.push('role = ?'); vals.push(patch.role); }
      if (patch.passwordHash !== undefined) { sets.push('password_hash = ?'); vals.push(patch.passwordHash); }
      if (patch.lastLogin !== undefined) { sets.push('last_login = ?'); vals.push(patch.lastLogin); }
      if (sets.length === 0) return;
      await db.run(`UPDATE ${t('users')} SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    },
    async deleteUser(id) {
      await db.run(`DELETE FROM ${t('users')} WHERE id = ?`, [id]);
    },
    async putAttachment(a) {
      const next = await db.transaction(async (tx) => {
        const res = await tx.get(`SELECT 1 AS x FROM ${t('reservations')} WHERE id = ?`, [a.reservationId]);
        if (!res) throw new HttpError(422, 'La reserva no existe');
        await tx.run(
          `INSERT INTO ${t('attachments')}(id, reservation_id, name, label, mime, size, data, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, label = excluded.label, mime = excluded.mime, size = excluded.size, data = excluded.data`,
          [a.id, a.reservationId, a.name, a.label ?? '', a.mime, Math.floor((a.data.length * 3) / 4), a.data, now()],
        );
        return bump(tx);
      });
      onChange?.(next);
      return next;
    },
    async labelAttachment(id, label) {
      const next = await db.transaction(async (tx) => {
        const res = await tx.run(`UPDATE ${t('attachments')} SET label = ? WHERE id = ?`, [label, id]);
        if (res.changes === 0) throw new HttpError(404, 'Archivo no encontrado');
        return bump(tx);
      });
      onChange?.(next);
      return next;
    },
    async getAttachment(id) {
      const row = await db.get(`SELECT name, mime, data FROM ${t('attachments')} WHERE id = ?`, [id]);
      return row ? { name: String(row.name), mime: String(row.mime), data: String(row.data) } : null;
    },
    async deleteAttachment(id) {
      const next = await db.transaction(async (tx) => {
        await tx.run(`DELETE FROM ${t('attachments')} WHERE id = ?`, [id]);
        return bump(tx);
      });
      onChange?.(next);
      return next;
    },
    async isEmpty() {
      return !(await db.get(`SELECT 1 AS x FROM ${t('trip')} LIMIT 1`));
    },
    async applyOps(ops) {
      const next = await db.transaction(async (tx) => {
        for (const op of ops) await applyOp(tx, op);
        return bump(tx);
      });
      onChange?.(next);
      return next;
    },
    async importSnapshot(input) {
      // Los destinos del archivo deben estar registrados antes de validar los días que los usan.
      const destinosArchivo = destinosMap.safeParse((input as { destinos?: unknown } | null)?.destinos);
      if (destinosArchivo.success && destinosArchivo.data) registrarDestinos(destinosArchivo.data);
      let parsed;
      try {
        parsed = importSchema.parse(input);
      } catch (err) {
        if (err instanceof ZodError) {
          throw new HttpError(422, 'El archivo no tiene el formato esperado', err.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })));
        }
        throw err;
      }
      const next = await db.transaction(async (tx) => {
        for (const name of ['activities', 'days', 'checklist', 'reservations', 'expenses']) await tx.run(`DELETE FROM ${t(name)}`);
        const hasTrip = await tx.get(`SELECT 1 AS x FROM ${t('trip')} WHERE id = 1`);
        if (!hasTrip) {
          await tx.run(`INSERT INTO ${t('trip')}(id, name, timezone, updated_at) VALUES(1, 'Mi viaje', 'America/New_York', ?)`, [now()]);
        }
        await patchTrip(tx, parsed.trip);
        await putMany(tx, SPECS.day, parsed.days);
        await putMany(tx, SPECS.activity, parsed.activities);
        await putMany(tx, SPECS.checklist, parsed.checklist);
        await putMany(tx, SPECS.reservation, parsed.reservations);
        await putMany(tx, SPECS.expense, parsed.expenses);
        if (parsed.destinos) await setMeta('destinos', JSON.stringify({ ...(await getDestinos(tx)), ...parsed.destinos }), tx);
        return bump(tx);
      });
      onChange?.(next);
      return next;
    },
  };
}
