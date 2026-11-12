import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AccountUser, UserRole } from '../../shared/types';
import { HttpError } from './errors';
import { VIAJE_PREDETERMINADO, type Store, type UserRow } from './store';

const COOKIE = 'viaje_session';
const MAX_AGE_S = 60 * 60 * 24 * 90;
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const scrypt = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt1$${salt.toString('hex')}$${(await scrypt(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [tag, saltHex, hashHex] = stored.split('$');
  if (tag !== 'scrypt1' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const normalizeEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();

const publicUser = (u: UserRow): AccountUser => ({ id: u.id, email: u.email, role: u.role, hasPassword: u.passwordHash !== '', lastLogin: u.lastLogin });

export type AuthedRequest = Request & {
  user?: UserRow;
  /** Viaje al que da acceso la clave del calendario usada (sin cuenta). */
  viajeCalendario?: number;
};

/**
 * `seedUsers`: cuentas que existen desde el primer arranque, con formato `correo:admin,correo2:member`
 * (la primera administra). Sin ellas, con `ACCESS_CODE` nadie puede entrar.
 */
export async function createAuth(store: Store, accessCode: string, seedUsers = '') {
  const enabled = accessCode.length > 0;

  let secret = await store.getMeta('session_secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    await store.setMeta('session_secret', secret);
    // Si otra instancia arrancó a la vez, todas deben quedarse con el mismo secreto.
    secret = (await store.getMeta('session_secret')) ?? secret;
  }
  const sign = (payload: string) => createHmac('sha256', secret!).update(payload).digest('hex');

  /** Clave estable para suscribirse al calendario (los clientes de calendario no envían cookies). Cada viaje tiene la suya. */
  const icsKey = (viaje: number = VIAJE_PREDETERMINADO) =>
    viaje === VIAJE_PREDETERMINADO ? sign('ics').slice(0, 24) : `${viaje}.${sign(`ics:${viaje}`).slice(0, 24)}`;
  /** Viaje al que da acceso una clave del calendario, o null. Las claves del viaje 1 conservan el formato anterior. */
  const viajeDeIcsKey = (key: string): number | null => {
    const m = /^([1-9]\d{0,8})\.([0-9a-f]{24})$/.exec(key);
    if (m) {
      const viaje = Number(m[1]);
      return viaje !== VIAJE_PREDETERMINADO && safeEqual(m[2], sign(`ics:${viaje}`).slice(0, 24)) ? viaje : null;
    }
    return safeEqual(key, icsKey()) ? VIAJE_PREDETERMINADO : null;
  };

  // Primer arranque: se crean las cuentas autorizadas (sin contraseña: la definen al entrar por primera vez).
  if (enabled && (await store.listUsers()).length === 0) {
    for (const item of seedUsers.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [email, role] = item.split(':');
      const e = normalizeEmail(email);
      if (EMAIL_RE.test(e) && !(await store.findUserByEmail(e))) await store.createUser({ id: randomUUID(), email: e, role: role === 'admin' ? 'admin' : 'member', tripId: VIAJE_PREDETERMINADO });
    }
    if ((await store.listUsers()).length === 0) {
      console.warn('ACCESS_CODE está definido, pero no hay cuentas. Define SEED_USERS="tu@correo.com:admin" antes de arrancar.');
    }
  }

  /** Cada viaje tiene su propio interruptor de acceso compartido (el del viaje 1 conserva la clave anterior). */
  const claveSharing = (viaje: number) => (viaje === VIAJE_PREDETERMINADO ? 'sharing' : `sharing:${viaje}`);
  const sharingOn = async (viaje: number = VIAJE_PREDETERMINADO) => (await store.getMeta(claveSharing(viaje))) !== '0';

  /** El token lleva la «huella» de la contraseña: al cambiarla o restablecerla, las sesiones anteriores dejan de valer. */
  const pwTag = (u: UserRow) => createHmac('sha256', secret!).update(u.passwordHash).digest('hex').slice(0, 10);
  function makeToken(u: UserRow) {
    const payload = `${u.id}.${Date.now() + MAX_AGE_S * 1000}.${pwTag(u)}`;
    return `${payload}.${sign(payload)}`;
  }
  function setCookie(req: Request, res: Response, u: UserRow) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(makeToken(u))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`);
  }

  // Caché corta para no consultar la base en cada petición.
  const cache = new Map<string, { user: UserRow | null; at: number }>();
  async function userFor(req: Request): Promise<UserRow | null> {
    const token = readCookie(req, COOKIE);
    const parts = token.split('.');
    if (parts.length !== 4) return null;
    const [uid, exp, tag, sig] = parts;
    if (!safeEqual(sig, sign(`${uid}.${exp}.${tag}`)) || Number(exp) <= Date.now()) return null;
    let hit = cache.get(uid);
    if (!hit || Date.now() - hit.at > 15_000) {
      hit = { user: await store.getUser(uid), at: Date.now() };
      cache.set(uid, hit);
    }
    const u = hit.user;
    if (!u || u.passwordHash === '' || pwTag(u) !== tag) return null;
    return u;
  }
  const forget = (id: string) => cache.delete(id);

  async function guard(req: AuthedRequest, res: Response, next: NextFunction) {
    if (!enabled) return next();
    const u = await userFor(req);
    if (u) {
      if (u.role !== 'admin' && !(await sharingOn(u.tripId))) {
        res.status(403).json({ error: 'sharing_off' });
        return;
      }
      req.user = u;
      return next();
    }
    if (req.path === '/calendar.ics' && typeof req.query.key === 'string') {
      const viaje = viajeDeIcsKey(req.query.key);
      if (viaje !== null) {
        req.viajeCalendario = viaje;
        return next();
      }
    }
    res.status(401).json({ error: 'auth_required' });
  }

  async function status(req: AuthedRequest, res: Response) {
    if (!enabled) {
      res.json({ required: false, authenticated: true, user: null });
      return;
    }
    const u = await userFor(req);
    const ok = !!u && (u.role === 'admin' || (await sharingOn(u.tripId)));
    res.json({ required: true, authenticated: ok, user: ok && u ? publicUser(u) : null, sharingOff: !!u && !ok });
  }

  /** Paso 1 del ingreso: ¿este correo tiene acceso, y ya definió su contraseña? */
  async function start(req: Request, res: Response) {
    const email = normalizeEmail(req.body?.email);
    const u = EMAIL_RE.test(email) ? await store.findUserByEmail(email) : null;
    if (!u) throw new HttpError(403, 'Este correo no tiene acceso. Pide a quien administra el viaje que te agregue.');
    if (u.role !== 'admin' && !(await sharingOn(u.tripId))) throw new HttpError(403, 'El acceso compartido está desactivado por ahora.');
    res.json({ state: u.passwordHash === '' ? 'setup' : 'login', email });
  }

  async function login(req: Request, res: Response) {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? '');
    const u = await store.findUserByEmail(email);
    const ok = !!u && u.passwordHash !== '' && (await verifyPassword(password, u.passwordHash));
    if (!ok || !u) throw new HttpError(401, 'Correo o contraseña incorrectos.');
    if (u.role !== 'admin' && !(await sharingOn(u.tripId))) throw new HttpError(403, 'El acceso compartido está desactivado por ahora.');
    await store.updateUser(u.id, { lastLogin: Date.now() });
    setCookie(req, res, u);
    res.json({ ok: true, user: publicUser(u) });
  }

  /** Primer ingreso: define la contraseña. Pide el código de invitación (el código de acceso del viaje) para que nadie pueda reclamar una cuenta ajena. */
  async function setup(req: Request, res: Response) {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? '');
    const password = String(req.body?.password ?? '');
    const u = await store.findUserByEmail(email);
    if (!u) throw new HttpError(403, 'Este correo no tiene acceso.');
    if (u.passwordHash !== '') throw new HttpError(409, 'Esta cuenta ya tiene contraseña. Inicia sesión.');
    if (!safeEqual(code, accessCode)) throw new HttpError(401, 'Código de invitación incorrecto.');
    if (password.length < MIN_PASSWORD) throw new HttpError(422, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (u.role !== 'admin' && !(await sharingOn(u.tripId))) throw new HttpError(403, 'El acceso compartido está desactivado por ahora.');
    const passwordHash = await hashPassword(password);
    await store.updateUser(u.id, { passwordHash, lastLogin: Date.now() });
    forget(u.id);
    const fresh = { ...u, passwordHash };
    setCookie(req, res, fresh);
    res.json({ ok: true, user: publicUser(fresh) });
  }

  async function changePassword(req: AuthedRequest, res: Response) {
    const u = req.user;
    if (!u) throw new HttpError(401, 'auth_required');
    const next = String(req.body?.next ?? '');
    if (!(await verifyPassword(String(req.body?.current ?? ''), u.passwordHash))) throw new HttpError(401, 'La contraseña actual no es correcta.');
    if (next.length < MIN_PASSWORD) throw new HttpError(422, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    const passwordHash = await hashPassword(next);
    await store.updateUser(u.id, { passwordHash });
    forget(u.id);
    setCookie(req, res, { ...u, passwordHash });
    res.json({ ok: true });
  }

  function logout(_req: Request, res: Response) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  }

  /* ---------- Administración de cuentas (solo admin) ---------- */
  const admin = (req: AuthedRequest) => {
    if (enabled && req.user?.role !== 'admin') throw new HttpError(403, 'Solo la persona administradora puede hacer esto.');
  };
  /** Viaje de la persona administradora: solo administra las cuentas de ese viaje. */
  const viajeDelAdmin = (req: AuthedRequest) => {
    if (!req.user) throw new HttpError(401, 'auth_required');
    return req.user.tripId;
  };
  const sharingDe = (req: AuthedRequest) => sharingOn(viajeDelAdmin(req));
  const usuariosDe = async (req: AuthedRequest) => (await store.listUsers(viajeDelAdmin(req))).map(publicUser);
  const needAccounts = () => {
    if (!enabled) throw new HttpError(409, 'Las cuentas requieren un código de acceso configurado en el servidor.');
  };

  async function listUsers(req: AuthedRequest, res: Response) {
    needAccounts();
    admin(req);
    res.json({ sharing: await sharingDe(req), users: await usuariosDe(req) });
  }
  async function addUser(req: AuthedRequest, res: Response) {
    needAccounts();
    admin(req);
    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_RE.test(email)) throw new HttpError(422, 'Escribe un correo válido.');
    if (await store.findUserByEmail(email)) throw new HttpError(409, 'Ese correo ya tiene acceso.');
    const role: UserRole = req.body?.role === 'admin' ? 'admin' : 'member';
    await store.createUser({ id: randomUUID(), email, role, tripId: viajeDelAdmin(req) });
    res.json({ sharing: await sharingDe(req), users: await usuariosDe(req) });
  }
  async function patchUser(req: AuthedRequest, res: Response) {
    needAccounts();
    admin(req);
    const u = await store.getUser(String(req.params.id));
    if (!u || u.tripId !== viajeDelAdmin(req)) throw new HttpError(404, 'Cuenta no encontrada');
    if (req.body?.role === 'admin' || req.body?.role === 'member') {
      if (u.id === req.user?.id && req.body.role !== 'admin') throw new HttpError(409, 'No puedes quitarte a ti mismo el rol de administrador.');
      await store.updateUser(u.id, { role: req.body.role });
    }
    if (req.body?.resetPassword === true) await store.updateUser(u.id, { passwordHash: '' });
    forget(u.id);
    res.json({ sharing: await sharingDe(req), users: await usuariosDe(req) });
  }
  async function removeUser(req: AuthedRequest, res: Response) {
    needAccounts();
    admin(req);
    const u = await store.getUser(String(req.params.id));
    if (!u || u.tripId !== viajeDelAdmin(req)) throw new HttpError(404, 'Cuenta no encontrada');
    if (u.id === req.user?.id) throw new HttpError(409, 'No puedes eliminar tu propia cuenta.');
    await store.deleteUser(u.id);
    forget(u.id);
    res.json({ sharing: await sharingDe(req), users: await usuariosDe(req) });
  }
  async function setSharing(req: AuthedRequest, res: Response) {
    needAccounts();
    admin(req);
    await store.setMeta(claveSharing(viajeDelAdmin(req)), req.body?.enabled === false ? '0' : '1');
    res.json({ sharing: await sharingDe(req), users: await usuariosDe(req) });
  }

  return { enabled, guard, status, start, login, setup, changePassword, logout, icsKey, viajeDeIcsKey, listUsers, addUser, patchUser, removeUser, setSharing };
}
