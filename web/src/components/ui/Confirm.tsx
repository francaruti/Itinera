import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}

export function Confirm({ open, title, message, confirmLabel = 'Confirmar', onConfirm, onCancel }: Props) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="muted">{message}</p>
      <div className="sheet-foot" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn accent" onClick={onConfirm} data-autofocus>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
