import { RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { Ambient } from './Ambient';
import { Logo } from './Logo';

export function Loading() {
  return (
    <div className="container" style={{ paddingTop: 24 }} aria-busy="true" aria-label="Cargando">
      <Ambient />
      <div className="skeleton" style={{ height: 300, borderRadius: 32, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 100, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 24 }} />
    </div>
  );
}

export function ErrorScreen() {
  const init = useStore((s) => s.init);
  return (
    <div className="boot">
      <Ambient />
      <div className="card boot-card">
        <Logo size={56} />
        <h1 className="h-stretch">No se pudo conectar</h1>
        <p className="muted">No hay conexión con el servidor y todavía no hay datos guardados en este dispositivo.</p>
        <button className="btn" onClick={() => void init()}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    </div>
  );
}
