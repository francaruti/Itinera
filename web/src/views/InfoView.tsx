import { Calculator, Clock, Images, Plug, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useNow } from '../hooks/useNow';
import { money } from '../lib/format';
import { PHOTOS } from '../lib/photos';
import { Photo } from '../components/photos/Photo';
import { Phrases } from '../components/info/Phrases';
import { useStore } from '../store';

/** Zona horaria del dispositivo: la hora «de casa» para compararla con la del destino. */
const CASA = Intl.DateTimeFormat().resolvedOptions().timeZone;

function Clocks() {
  const now = useNow(20_000);
  const destino = useStore((s) => s.snap?.trip.timezone) || CASA;
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('es', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
  const day = (tz: string) => new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' }).format(now);
  const offset = (tz: string) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now).find((x) => x.type === 'timeZoneName')?.value ?? '';
    const m = /GMT([+-]\d+)/.exec(p);
    return m ? Number(m[1]) : 0;
  };
  const diff = offset(destino) - offset(CASA);
  return (
    <section className="card">
      <h2 className="card-title h-stretch">
        <Clock size={18} /> Hora local
      </h2>
      <div className="clocks">
        <div className="clock">
          <small>Destino</small>
          <strong className="tnum">{fmt(destino)}</strong>
          <span>{day(destino)}</span>
        </div>
        <div className="clock">
          <small>Tu dispositivo</small>
          <strong className="tnum">{fmt(CASA)}</strong>
          <span>{day(CASA)}</span>
        </div>
      </div>
      <p className="muted small">
        {diff === 0
          ? 'El destino tiene la misma hora que tu dispositivo.'
          : `El destino va ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'hora' : 'horas'} ${diff > 0 ? 'adelante' : 'atrás'} de tu dispositivo en estas fechas.`}
      </p>
    </section>
  );
}

function Tip() {
  const [bill, setBill] = useState('');
  const [pct, setPct] = useState(20);
  const [people, setPeople] = useState(1);
  const b = Number(bill.replace(',', '.')) || 0;
  const tip = (b * pct) / 100;
  const total = b + tip;
  return (
    <section className="card">
      <h2 className="card-title h-stretch">
        <Calculator size={18} /> Calculadora de propina
      </h2>
      <label className="field">
        <span>Cuenta antes de propina (USD)</span>
        <input className="input" inputMode="decimal" value={bill} onChange={(e) => setBill(e.target.value)} placeholder="0.00" />
      </label>
      <div className="row wrap" style={{ margin: '12px 0' }}>
        {[15, 18, 20, 22].map((p) => (
          <button key={p} className="chip pick" aria-pressed={pct === p} onClick={() => setPct(p)}>
            {p}%
          </button>
        ))}
        <span className="grow" />
        <label className="row small" style={{ gap: 6 }}>
          Personas
          <input className="input" style={{ width: 64 }} type="number" min={1} max={20} value={people} onChange={(e) => setPeople(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        </label>
      </div>
      <div className="tip-result">
        <div>
          <small>Propina</small>
          <strong className="tnum">{money(tip)}</strong>
        </div>
        <div>
          <small>Total</small>
          <strong className="tnum">{money(total)}</strong>
        </div>
        <div>
          <small>Por persona</small>
          <strong className="tnum">{money(total / people)}</strong>
        </div>
      </div>
      <p className="muted small">Ajusta el porcentaje a la costumbre del lugar.</p>
    </section>
  );
}

export default function InfoView() {
  const fotos = Object.values(PHOTOS);
  return (
    <div className="container">
      <header className="view-head">
        <div>
          <h1 className="display view-title">Info útil</h1>
          <p className="muted">Datos prácticos, hora y propinas. El pronóstico está en Clima.</p>
        </div>
      </header>

      <div className="info-grid">
        <section className="card">
          <h2 className="card-title h-stretch">
            <ShieldAlert size={18} /> Datos prácticos
          </h2>
          <ul className="facts-list">
            <li>
              <strong>Emergencias:</strong> guarda el número de emergencias del país que visitas.
            </li>
            <li>
              <Plug size={14} /> <strong>Enchufes:</strong> revisa el voltaje y el tipo de enchufe antes de viajar.
            </li>
            <li>
              <strong>Impuestos y propina:</strong> revisa si el precio final los incluye antes de pagar.
            </li>
            <li>
              <strong>Documentos:</strong> lleva tu documento de viaje en el equipaje de mano y una copia digital.
            </li>
            <li>
              <strong>Transporte:</strong> si hay una app de transporte local, instálala antes de llegar.
            </li>
          </ul>
        </section>
        <Phrases />
        <Clocks />
        <Tip />
      </div>

      {fotos.length > 0 && (
        <details className="card credits" style={{ marginTop: 18 }}>
          <summary className="h-stretch">
            <Images size={18} /> Créditos de las fotos <span className="chip">{fotos.length}</span>
          </summary>
          <p className="muted small" style={{ marginTop: 8 }}>
            Fotografías de Wikimedia Commons con licencias Creative Commons o dominio público. Toca el nombre para ver el original y su licencia.
          </p>
          <ul>
            {fotos.map((p) => (
              <li key={p.key}>
                <Photo photo={p} width={500} alt="" />
                <span>
                  <strong>
                    <a href={p.page} target="_blank" rel="noreferrer">
                      {p.name}
                    </a>
                  </strong>
                  {p.author} ·{' '}
                  <a href={p.licenseUrl || p.page} target="_blank" rel="noreferrer">
                    {p.license}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
