import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { APP_NAME } from '../../../shared/constants';
import { ApiError, api, NetworkError } from '../lib/api';
import { TABS, useStore } from '../store';
import { Ambient } from './Ambient';
import { Logo } from './Logo';
import { TAB_META } from './nav';

type Step = 'email' | 'login' | 'setup';

export function LockScreen() {
  const enter = useStore((s) => s.enter);
  const lockNote = useStore((s) => s.lockNote);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) =>
    setError(err instanceof NetworkError ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : err instanceof ApiError ? err.message : 'Algo salió mal. Inténtalo de nuevo.');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 'email') {
        const r = await api.authStart(email.trim());
        setEmail(r.email);
        setStep(r.state);
      } else if (step === 'login') {
        const r = await api.login(email, password);
        await enter(r.user);
      } else {
        if (password !== password2) {
          setError('Las contraseñas no coinciden.');
          return;
        }
        const r = await api.setup(email, code.trim(), password);
        await enter(r.user);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setStep('email');
    setPassword('');
    setPassword2('');
    setCode('');
    setError('');
  };
  const canSubmit = step === 'email' ? email.includes('@') : step === 'login' ? password.length > 0 : code.length > 0 && password.length >= 8 && password2.length > 0;

  return (
    <div className="boot">
      <Ambient />
      <motion.form
        className="card boot-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <Logo size={56} />
        <h1 className="h-stretch">{APP_NAME}</h1>
        {lockNote && step === 'email' && <p className="lock-note">{lockNote}</p>}

        {step === 'email' && (
          <>
            <p className="lock-pitch">Itinerario día a día, mapa, reservas, pendientes, presupuesto y clima.</p>
            <ul className="lock-sections" aria-label="Lo que incluye la app">
              {TABS.map((id) => {
                const { label, icon: Icon } = TAB_META[id];
                return (
                  <li key={id}>
                    <Icon size={14} aria-hidden="true" /> {label}
                  </li>
                );
              })}
            </ul>
            <p className="muted">Entra con tu correo. Solo pueden entrar las personas que el administrador agregó.</p>
            <label className="field" style={{ width: '100%', textAlign: 'left' }}>
              <span>Correo</span>
              <input className="input" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" data-autofocus aria-invalid={!!error} />
            </label>
          </>
        )}

        {step !== 'email' && (
          <button type="button" className="lock-who" onClick={back} aria-label="Cambiar de correo">
            <ArrowLeft size={14} /> <span className="clamp-1">{email}</span>
          </button>
        )}

        {step === 'login' && (
          <label className="field" style={{ width: '100%', textAlign: 'left' }}>
            <span>Contraseña</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} data-autofocus aria-invalid={!!error} />
          </label>
        )}

        {step === 'setup' && (
          <>
            <p className="muted">Es tu primer ingreso: crea tu contraseña. Necesitas el código de invitación (el código de acceso del viaje).</p>
            <label className="field" style={{ width: '100%', textAlign: 'left' }}>
              <span>Código de invitación</span>
              <input className="input" type="password" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} data-autofocus />
            </label>
            <label className="field" style={{ width: '100%', textAlign: 'left' }}>
              <span>Nueva contraseña (mínimo 8 caracteres)</span>
              <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="field" style={{ width: '100%', textAlign: 'left' }}>
              <span>Repite la contraseña</span>
              <input className="input" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </label>
          </>
        )}

        {error && (
          <small className="field-error" role="alert" style={{ width: '100%', textAlign: 'left' }}>
            {error}
          </small>
        )}
        <button className="btn block" type="submit" disabled={!canSubmit || busy}>
          {step === 'email' ? <Mail size={16} /> : step === 'setup' ? <KeyRound size={16} /> : <Lock size={16} />}{' '}
          {busy ? 'Verificando…' : step === 'email' ? 'Continuar' : step === 'setup' ? 'Crear contraseña y entrar' : 'Entrar'}
        </button>
        {step === 'email' && (
          <small className="muted lock-legal">
            <a href="#/legal/privacidad">Privacidad</a> · <a href="#/legal/terminos">Términos</a>
          </small>
        )}
        {step === 'email' && (
          <a className="lock-volver" href="#/">
            <ArrowLeft size={14} aria-hidden="true" /> Volver a la portada
          </a>
        )}
      </motion.form>
    </div>
  );
}
