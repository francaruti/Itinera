import { RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Cambia (p. ej. al navegar) para limpiar un error previo. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

const isChunkError = (e: Error) => /Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(`${e.name} ${e.message}`);

/** Evita la pantalla en blanco: muestra un mensaje amable y, si es un módulo obsoleto tras un despliegue, recarga una vez. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isChunkError(error)) {
      try {
        if (sessionStorage.getItem('viaje:chunk-reload') !== '1') {
          sessionStorage.setItem('viaje:chunk-reload', '1');
          location.reload();
        }
      } catch {
        /* sin sessionStorage */
      }
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container">
        <div className="card boot-card" role="alert" style={{ margin: '48px auto' }}>
          <h1 className="h-stretch">Algo salió mal</h1>
          <p className="muted">Esta sección no pudo mostrarse. Tus datos están a salvo; intenta recargar.</p>
          <button className="btn" onClick={() => location.reload()}>
            <RefreshCw size={16} /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
