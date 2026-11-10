import { KeyRound, LogOut, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { AccountUser } from '../../../shared/types';
import { ApiError, api, type UsersPayload } from '../lib/api';
import { useStore } from '../store';
import { Confirm } from './ui/Confirm';
import { Seg } from './ui/Seg';

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'No se pudo completar (¿sin conexión?).');

/** Cuenta propia (contraseña, cerrar sesión) y, para quien administra, el acceso compartido al viaje. */
export function AccountSection() {
  const me = useStore((s) => s.me);
  const logout = useStore((s) => s.logout);
  const toast = useStore((s) => s.toast);
  const [data, setData] = useState<UsersPayload | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [del, setDel] = useState<AccountUser | null>(null);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    api.users().then(setData).catch(() => undefined);
  }, [isAdmin]);

  if (!me) return null;

  const run = async (fn: () => Promise<UsersPayload>, ok?: string) => {
    setBusy(true);
    try {
      setData(await fn());
      if (ok) toast(ok, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await run(() => api.addUser(email.trim()), 'Acceso agregado. En su primer ingreso definirá su contraseña.');
    setEmail('');
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    try {
      await api.changePassword(cur, next);
      toast('Contraseña actualizada', 'success');
      setPwOpen(false);
      setCur('');
      setNext('');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <>
      <section>
        <h3>Mi cuenta</h3>
        <div className="acct-me">
          <strong className="clamp-2">{me.email}</strong>
          <span className="chip">{isAdmin ? 'Administrador' : 'Miembro'}</span>
        </div>
        <div className="row wrap">
          <button className="btn ghost" onClick={() => setPwOpen((o) => !o)} aria-expanded={pwOpen}>
            <KeyRound size={16} /> Cambiar contraseña
          </button>
          <button className="btn ghost" onClick={() => void logout()}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
        {pwOpen && (
          <form className="acct-form" onSubmit={savePassword}>
            <label className="field">
              <span>Contraseña actual</span>
              <input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </label>
            <label className="field">
              <span>Nueva contraseña (mínimo 8)</span>
              <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <button className="btn accent" type="submit" disabled={!cur || next.length < 8}>
              Guardar contraseña
            </button>
          </form>
        )}
      </section>

      {isAdmin && (
        <section>
          <h3>Datos compartidos</h3>
          <small className="muted">
            Solo las personas que agregues pueden entrar. Todas ven y editan este viaje, incluidos archivos y gastos.
          </small>
          {data && (
            <>
              <Seg<'on' | 'off'>
                value={data.sharing ? 'on' : 'off'}
                onChange={(v) => void run(() => api.setSharing(v === 'on'), v === 'on' ? 'Datos compartidos activados' : 'Datos compartidos desactivados')}
                label="Datos compartidos"
                options={[
                  { value: 'on', label: 'Activados' },
                  { value: 'off', label: 'Desactivados' },
                ]}
              />
              {!data.sharing && <small className="muted">Mientras estén desactivados, solo los administradores pueden entrar.</small>}
              <ul className="acct-list">
                {data.users.map((u) => (
                  <li key={u.id}>
                    <div className="acct-who">
                      <strong className="clamp-1">{u.email}</strong>
                      <small className="muted">
                        {u.role === 'admin' ? 'Administrador' : 'Miembro'} · {u.hasPassword ? 'cuenta activa' : 'falta crear contraseña'}
                      </small>
                    </div>
                    {u.id !== me.id && (
                      <div className="acct-actions">
                        <button
                          className="btn ghost sm"
                          disabled={busy}
                          onClick={() => void run(() => api.patchUser(u.id, { resetPassword: true }), 'Contraseña restablecida: la definirá al volver a entrar.')}
                        >
                          Restablecer
                        </button>
                        <button className="icon-btn sm danger" aria-label={`Quitar acceso a ${u.email}`} onClick={() => setDel(u)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <form className="acct-add" onSubmit={invite}>
                <input className="input grow" type="email" inputMode="email" autoCapitalize="none" placeholder="Correo de la persona" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo a agregar" />
                <button className="btn accent" type="submit" disabled={busy || !email.includes('@')}>
                  <UserPlus size={16} /> Agregar
                </button>
              </form>
              <small className="muted">En su primer ingreso necesitará el código de invitación (el código de acceso del viaje) para crear su contraseña.</small>
            </>
          )}
        </section>
      )}
      <Confirm
        open={!!del}
        title="Quitar acceso"
        message={`¿Quitar el acceso a ${del?.email ?? ''}? Ya no podrá entrar al viaje.`}
        confirmLabel="Quitar"
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (del) void run(() => api.removeUser(del.id), 'Acceso eliminado');
          setDel(null);
        }}
      />
    </>
  );
}
