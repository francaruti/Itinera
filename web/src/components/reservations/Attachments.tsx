import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ExternalLink, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Attachment, Reservation } from '../../../../shared/types';
import { attachmentUrl, formatBytes } from '../../lib/files';
import { useStore } from '../../store';
import { Confirm } from '../ui/Confirm';

/** Visor a pantalla completa para capturas y pases de abordar (se amplía con los dedos; con varias imágenes, se desliza entre ellas). */
export function FileViewer({ file, files, onChange, onClose }: { file: Attachment | null; files?: Attachment[]; onChange?(f: Attachment): void; onClose(): void }) {
  const list = files && files.length > 1 ? files : null;
  const idx = list && file ? list.findIndex((f) => f.id === file.id) : -1;
  const go = (d: -1 | 1) => list && idx >= 0 && onChange?.(list[(idx + d + list.length) % list.length]);
  const goRef = useRef(go);
  goRef.current = go;
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.stopImmediatePropagation();
        goRef.current(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [file, onClose]);

  return createPortal(
    <AnimatePresence>
      {file && (
        <motion.div className="viewer" role="dialog" aria-modal="true" aria-label={file.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="viewer-bar">
            <span className="clamp-1">
              {file.label || file.name}
              {list && idx >= 0 ? ` · ${idx + 1}/${list.length}` : ''}
            </span>
            <a className="icon-btn" href={attachmentUrl(file.id)} target="_blank" rel="noreferrer" aria-label="Abrir en una pestaña nueva">
              <ExternalLink size={18} />
            </a>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar" data-autofocus>
              <X size={20} />
            </button>
          </div>
          <div
            className="viewer-stage"
            onClick={onClose}
            onTouchStart={(e) => (touch.current = e.touches.length === 1 ? e.touches[0].clientX : null)}
            onTouchEnd={(e) => {
              const x0 = touch.current;
              touch.current = null;
              if (x0 != null && list && Math.abs(e.changedTouches[0].clientX - x0) > 70) go(e.changedTouches[0].clientX < x0 ? 1 : -1);
            }}
          >
            <img key={file.id} src={attachmentUrl(file.id)} alt={file.name} onClick={(e) => e.stopPropagation()} />
          </div>
          {list && (
            <>
              <button className="viewer-nav prev" onClick={() => go(-1)} aria-label="Anterior">
                ‹
              </button>
              <button className="viewer-nav next" onClick={() => go(1)} aria-label="Siguiente">
                ›
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Nombre/persona de cada archivo (p. ej. «Pase de Ana»): se guarda al salir del campo. */
function LabelInput({ file, listId }: { file: Attachment; listId: string }) {
  const labelAttachment = useStore((s) => s.labelAttachment);
  const [v, setV] = useState(file.label);
  useEffect(() => setV(file.label), [file.label]);
  const commit = () => {
    const t = v.trim();
    if (t !== file.label) void labelAttachment(file.id, t);
  };
  return (
    <input
      className="att-label"
      value={v}
      list={listId}
      maxLength={60}
      placeholder="¿De quién?"
      aria-label={`Nombre del archivo ${file.name}`}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Archivos de una reserva: miniaturas, abrir, añadir y quitar. */
export function AttachmentStrip({ r, addLabel = 'Añadir captura o archivo' }: { r: Reservation; addLabel?: string }) {
  const all = useStore((s) => s.snap?.attachments);
  const addAttachments = useStore((s) => s.addAttachments);
  const travelers = useStore((s) => s.snap?.trip.travelers ?? []);
  const listId = `trav-${r.id}`;
  const removeAttachment = useStore((s) => s.removeAttachment);
  const files = useMemo(() => (all ?? []).filter((a) => a.reservationId === r.id).sort((a, b) => a.createdAt - b.createdAt), [all, r.id]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<Attachment | null>(null);
  const [del, setDel] = useState<Attachment | null>(null);

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    await addAttachments(r.id, [...list]);
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  return (
    <div className="att">
      {files.length > 0 && (
        <ul className="att-list">
          {files.map((f) => {
            const pdf = f.mime === 'application/pdf';
            return (
              <li key={f.id} className="att-item">
                {pdf ? (
                  <a className="att-open" href={attachmentUrl(f.id)} target="_blank" rel="noreferrer" aria-label={`Abrir ${f.name}`}>
                    <span className="att-pdf">
                      <FileText size={26} />
                      <b>PDF</b>
                    </span>
                  </a>
                ) : (
                  <button className="att-open" onClick={() => setView(f)} aria-label={`Ver ${f.name}`}>
                    <img src={attachmentUrl(f.id)} alt="" loading="lazy" />
                  </button>
                )}
                <LabelInput file={f} listId={listId} />
                <small className="muted att-meta clamp-1">
                  {f.name} · {formatBytes(f.size)}
                </small>
                <button className="att-del" onClick={() => setDel(f)} aria-label={`Eliminar ${f.name}`}>
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <small className="muted att-hint">Imágenes o PDF de hasta 3 MB cada uno. Puedes elegir varios a la vez.</small>
      <datalist id={listId}>
        {travelers.map((t) => (
          <option key={t} value={`Pase de ${t}`} />
        ))}
        {travelers.map((t) => (
          <option key={`c-${t}`} value={t} />
        ))}
      </datalist>
      <button type="button" className="btn att-add" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 size={16} className="spin" /> : files.length ? <Plus size={16} /> : <Camera size={16} />}
        {busy ? 'Guardando…' : addLabel}
      </button>
      <input ref={input} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => void onPick(e.target.files)} />

      <FileViewer file={view} onClose={() => setView(null)} />
      <Confirm
        open={!!del}
        title="Eliminar archivo"
        message={`¿Eliminar «${del?.name ?? ''}»? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (del) void removeAttachment(del.id);
          setDel(null);
        }}
      />
    </div>
  );
}
