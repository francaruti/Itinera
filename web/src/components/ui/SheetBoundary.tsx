import { Component, type ReactNode } from 'react';
import { useStore } from '../../store';

interface State {
  failed: boolean;
}

/** Si una hoja falla al dibujarse, la app sigue funcionando (en vez de quedarse en blanco) y se avisa. */
export class SheetBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[SheetBoundary]', error);
    useStore.getState().toast('No se pudo abrir esa ventana. Recarga la app para actualizarla.', 'error', { label: 'Recargar', run: () => location.reload() });
    // se reintenta al siguiente toque
    useStore.setState({ docs: null });
    setTimeout(() => this.setState({ failed: false }), 800);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
