import { BedDouble, Check, Copy, ExternalLink, FileText, MapPin, Paperclip, Pencil, Plane, Plus, Ticket } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DOW_ES, MONTH_ES, dayDiff, dayOfMonth, dowIndex, formatTime12, monthIndex } from '../../../../shared/time';
import type { Attachment, Reservation } from '../../../../shared/types';
import { completeness, type FieldKey } from '../../lib/completeness';
import { attachmentUrl } from '../../lib/files';
import { copyText, mapsSearchUrl } from '../../lib/format';
import { success, tap } from '../../lib/haptics';
import { op } from '../../lib/ops';
import { photoForReservation } from '../../lib/photos';
import { useStore } from '../../store';
import { Photo } from '../photos/Photo';
import { AttachmentStrip, FileViewer } from './Attachments';

const short = (d: string) => `${DOW_ES[dowIndex(d)].slice(0, 3)} ${dayOfMonth(d)} ${MONTH_ES[monthIndex(d)].slice(0, 3)}`;
const parts = (iso: string) => (iso ? { date: iso.slice(0, 10), time: iso.length > 10 ? formatTime12(iso.slice(11, 16)) : '' } : null);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const STATUS = { booked: ['ok', 'Reservado'], pending: ['warn', 'Pendiente'], todo: ['todo', 'Por reservar'] } as const;

/** Código de barras decorativo: siempre el mismo para el mismo número de reserva. */
function Barcode({ seed, empty }: { seed: string; empty: boolean }) {
  const bars = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed || 'viajes-md') h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out: number[] = [];
    for (let i = 0; i < 44; i++) {
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
      out.push(1 + (h % 4));
    }
    return out;
  }, [seed]);
  let x = 0;
  return (
    <svg className={`wz-barcode${empty ? ' empty' : ''}`} viewBox="0 0 160 36" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w * 0.9} height={36} rx={0.4} /> : null;
        x += w * 0.9;
        return rect;
      })}
    </svg>
  );
}

/** Ilustración de fondo de cada tipo de tarjeta (formas simples, sin animación continua). */
function Art({ kind, photo }: { kind: 'flight' | 'hotel' | 'ticket'; photo: ReactNode }) {
  if (kind === 'hotel')
    return (
      <div className="wz-art" aria-hidden="true">
        {photo}
        <svg className="wz-skyline" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice">
          {[...Array(14)].map((_, i) => (
            <rect key={i} x={i * 30 - 6} y={140 - (38 + ((i * 53) % 70))} width={24} height={38 + ((i * 53) % 70)} rx={3} />
          ))}
        </svg>
      </div>
    );
  return (
    <div className="wz-art" aria-hidden="true">
      <svg className="wz-orbits" viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g-${kind}`} cx="82%" cy="12%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="520" fill={`url(#g-${kind})`} />
        {kind === 'flight' ? (
          <>
            <path d="M-30 330 Q 190 60 440 250" />
            <path d="M-30 390 Q 200 130 440 320" />
            <path d="M-30 450 Q 210 210 440 390" />
            {[...Array(18)].map((_, i) => (
              <circle key={i} cx={(i * 97) % 400} cy={(i * 61) % 300} r={i % 3 === 0 ? 2.4 : 1.4} className="dot" />
            ))}
          </>
        ) : (
          <>
            <circle cx="330" cy="70" r="120" />
            <circle cx="330" cy="70" r="80" />
            <circle cx="330" cy="70" r="40" />
            {[...Array(14)].map((_, i) => (
              <path key={i} d={`M${(i * 71) % 400} ${(i * 43) % 300} l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1z`} className="dot" />
            ))}
          </>
        )}
      </svg>
      {kind === 'flight' && <Plane className="wz-bigplane" size={230} strokeWidth={1.2} />}
      {kind === 'ticket' && <Ticket className="wz-bigplane" size={210} strokeWidth={1.2} />}
    </div>
  );
}

interface Props {
  r: Reservation;
  files: Attachment[];
  active: boolean;
  flipped: boolean;
  focus?: FieldKey;
  onFlip(field?: FieldKey): void;
  onUnflip(): void;
  onMore(id: string): void;
}

/** Tarjeta premium de una reserva: frente con lo esencial y atajos de un toque; al editar, gira y muestra los campos clave. */
export const WalletCard = memo(function WalletCard({ r, files, active, flipped, focus, onFlip, onUnflip, onMore }: Props) {
  const kind = r.kind === 'other' ? 'ticket' : r.kind;
  const toast = useStore((s) => s.toast);
  const ref = useRef<HTMLElement>(null);
  const [face, setFace] = useState<'front' | 'back'>(flipped ? 'back' : 'front');
  const [anim, setAnim] = useState<'' | 'out' | 'in'>('');
  const [view, setView] = useState<Attachment | null>(null);
  const [copied, setCopied] = useState(false);
  const { slots, done, total } = useMemo(() => completeness(r, files.length), [r, files.length]);
  const images = useMemo(() => files.filter((f) => f.mime !== 'application/pdf'), [files]);

  // Giro: sale de frente, cambia la cara y entra
  useEffect(() => {
    const want = flipped ? 'back' : 'front';
    if (want === face) return;
    setAnim('out');
    const t1 = setTimeout(() => {
      setFace(want);
      setAnim('in');
    }, 190);
    const t2 = setTimeout(() => setAnim(''), 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  // Inclinación según el puntero (solo con ratón; sin animaciones continuas)
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width;
      const y = (e.clientY - b.top) / b.height;
      el.style.setProperty('--ry', `${(x - 0.5) * 9}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * 7}deg`);
      el.style.setProperty('--gx', `${x * 100}%`);
      el.style.setProperty('--gy', `${y * 100}%`);
    };
    const leave = () => ['--rx', '--ry'].forEach((k) => el.style.setProperty(k, '0deg'));
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [active, face]);

  const start = parts(r.startsAt);
  const end = parts(r.endsAt);
  const [from, to] = kind === 'flight' && r.title.includes('→') ? r.title.split('→').map((s) => s.trim()) : [r.title, ''];
  const nights = kind === 'hotel' && start && end ? dayDiff(start.date, end.date) : 0;
  const cover = kind === 'hotel' ? photoForReservation(r) : null;
  const [stClass, stLabel] = STATUS[r.status];
  const Icon = kind === 'flight' ? Plane : kind === 'hotel' ? BedDouble : Ticket;
  const kindLabel = kind === 'flight' ? [r.provider, r.flightNo].filter(Boolean).join(' · ') || 'Vuelo' : kind === 'hotel' ? r.provider || 'Hotel' : r.provider || 'Entrada';

  const copy = async () => {
    if (!r.confirmation) return onFlip('confirmation');
    tap();
    const ok = await copyText(r.confirmation);
    if (ok) {
      success();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
    toast(ok ? `Número copiado: ${r.confirmation}` : 'No se pudo copiar', ok ? 'success' : 'error');
  };
  const openLink = () => (r.url ? window.open(r.url, '_blank', 'noopener,noreferrer') : onFlip('url'));
  const openFiles = () => {
    if (files.length === 0) return onFlip('files');
    const first = images[0];
    if (first) setView(first);
    else window.open(attachmentUrl(files[0].id), '_blank', 'noopener,noreferrer');
  };
  const when = (label: string, p: ReturnType<typeof parts>, fallback: FieldKey = 'dates') =>
    p ? (
      <div>
        <small>{label}</small>
        <strong>{short(p.date)}</strong>
        {p.time && <span className="wz-time">{p.time}</span>}
      </div>
    ) : (
      <button type="button" className="wz-ph" onClick={() => onFlip(fallback)}>
        <Plus size={13} /> {label}
      </button>
    );

  return (
    <article ref={ref} className={`wz wz-${kind}${anim ? ` flip-${anim}` : ''}${active ? ' active' : ''}`} aria-label={r.title}>
      {face === 'front' ? (
        <div className="wz-face">
          <Art kind={kind} photo={cover ? <Photo className="wz-photo" photo={cover} width={960} alt="" /> : null} />
          <div className="wz-shade" />

          <header className="wz-top">
            <span className="wz-chip">
              <Icon size={14} /> <span className="clamp-1">{kindLabel}</span>
            </span>
            <span className={`wz-status ${stClass}`}>
              {r.status === 'booked' && <Check size={12} />} {stLabel}
            </span>
          </header>

          {kind === 'flight' ? (
            <div className="wz-hero">
              <div className="wz-route">
                <strong className="clamp-2">{from}</strong>
                <span className="wz-plane" aria-hidden="true">
                  <i />
                  <Plane size={20} />
                  <i />
                </span>
                <strong className="clamp-2">{to || '—'}</strong>
              </div>
              <div className="wz-times">
                {when('Salida', start)}
                {when('Llegada', end)}
              </div>
            </div>
          ) : kind === 'hotel' ? (
            <div className="wz-hero wz-hero-hotel">
              <h3 className="clamp-2">{r.title}</h3>
              <div className="wz-glass">
                {start ? (
                  <>
                    <div>
                      <small>Check-in</small>
                      <strong>{short(start.date)}</strong>
                    </div>
                    <span className="wz-nights">{nights > 0 ? `${nights} ${nights === 1 ? 'noche' : 'noches'}` : '→'}</span>
                    <div>
                      <small>Check-out</small>
                      <strong>{end ? short(end.date) : '—'}</strong>
                    </div>
                  </>
                ) : (
                  <button type="button" className="wz-ph" onClick={() => onFlip('dates')}>
                    <Plus size={13} /> Añadir fechas
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="wz-hero">
              <h3 className="clamp-3">{r.title}</h3>
              <div className="wz-times">{when('Fecha', start)}</div>
            </div>
          )}

          <footer className="wz-stub">
            <div className="wz-code-row">
              <div className="wz-code-col">
                <small>N.º de reserva</small>
                {r.confirmation ? (
                  <button type="button" className={`wz-code${copied ? ' copied' : ''}`} onClick={copy} aria-label={`Copiar número de reserva ${r.confirmation}`}>
                    <span className="mono">{r.confirmation}</span>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                ) : (
                  <button type="button" className="wz-ph" onClick={() => onFlip('confirmation')}>
                    <Plus size={13} /> Añadir número
                  </button>
                )}
              </div>
              <Barcode seed={r.confirmation || r.title} empty={!r.confirmation} />
            </div>

            {(files.length > 0 || r.address) && (
              <div className="wz-extras">
                {files.slice(0, 3).map((f) =>
                  f.mime === 'application/pdf' ? (
                    <a key={f.id} className="wz-thumb pdf" href={attachmentUrl(f.id)} target="_blank" rel="noreferrer" aria-label={`Abrir ${f.label || f.name}`}>
                      <FileText size={18} />
                    </a>
                  ) : (
                    <button key={f.id} type="button" className="wz-thumb" onClick={() => setView(f)} aria-label={`Ver ${f.label || f.name}`}>
                      <img src={attachmentUrl(f.id)} alt="" loading="lazy" decoding="async" />
                    </button>
                  ),
                )}
                {files.length > 3 && <span className="wz-more">+{files.length - 3}</span>}
                {r.address && (
                  <a className="wz-addr" href={mapsSearchUrl(r.address)} target="_blank" rel="noreferrer">
                    <MapPin size={13} /> <span className="clamp-1">{r.address}</span>
                  </a>
                )}
              </div>
            )}

            <nav className="wz-actions" aria-label="Acciones rápidas">
              <button type="button" onClick={copy}>
                <span className={r.confirmation ? '' : 'miss'}>{r.confirmation ? <Copy size={19} /> : <Plus size={19} />}</span>
                <small>{r.confirmation ? 'Copiar' : 'Número'}</small>
              </button>
              <button type="button" onClick={openLink}>
                <span className={r.url ? '' : 'miss'}>{r.url ? <ExternalLink size={19} /> : <Plus size={19} />}</span>
                <small>{r.url ? hostOf(r.url).split('.')[0] || 'Abrir' : 'Enlace'}</small>
              </button>
              <button type="button" onClick={openFiles}>
                <span className={files.length ? '' : 'miss'}>{files.length ? <Paperclip size={19} /> : <Plus size={19} />}</span>
                <small>{files.length ? (kind === 'flight' ? 'Pase' : 'Archivos') : 'Subir'}</small>
              </button>
              <button type="button" onClick={() => onFlip()}>
                <span>
                  <Pencil size={19} />
                </span>
                <small>{done === total ? 'Editar' : `${done}/${total}`}</small>
              </button>
            </nav>
          </footer>
        </div>
      ) : (
        <QuickEdit r={r} kind={kind} focus={focus} done={done} total={total} missing={slots.filter((s) => !s.ok).map((s) => s.label)} onDone={onUnflip} onMore={() => onMore(r.id)} />
      )}
      <FileViewer file={view} files={images} onChange={setView} onClose={() => setView(null)} />
    </article>
  );
});

/** Reverso de la tarjeta: los campos clave, listos para escribir, con guardado automático. */
function QuickEdit({ r, kind, focus, done, total, missing, onDone, onMore }: { r: Reservation; kind: 'flight' | 'hotel' | 'ticket'; focus?: FieldKey; done: number; total: number; missing: string[]; onDone(): void; onMore(): void }) {
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const root = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ provider: r.provider, flightNo: r.flightNo ?? '', confirmation: r.confirmation, url: r.url });
  const patch = (data: Partial<Reservation>) => dispatch(op.reservation.patch(r.id, data));
  const set = (k: keyof typeof v, value: string, field: Partial<Reservation>) => {
    setV((s) => ({ ...s, [k]: value }));
    patch(field);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      const id = focus === 'provider' ? 'q-p' : focus === 'flightNo' ? 'q-f' : focus === 'url' ? 'q-u' : focus === 'files' ? '' : 'q-c';
      if (focus === 'files') root.current?.querySelector('.att')?.scrollIntoView({ block: 'center' });
      else (root.current?.querySelector(`#${id}-${r.id}`) as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(t);
  }, [focus, r.id]);

  const validUrl = (u: string) => u === '' || /^https?:\/\//i.test(u);
  return (
    <div className="wz-back" ref={root}>
      <header className="wz-back-head">
        <div>
          <small>Editar</small>
          <h3 className="clamp-1">{r.title}</h3>
        </div>
        <button type="button" className="wz-done" onClick={onDone}>
          <Check size={16} /> Listo
        </button>
      </header>

      <div className="wz-back-body">
        <p className="wz-hint">{missing.length ? `Falta: ${missing.join(', ').toLowerCase()}.` : '¡Todo completo! Puedes cambiar lo que quieras.'} <span className="muted">({done}/{total})</span></p>

        <div className={kind === 'flight' ? 'doc-pair' : 'doc-field'}>
          <label className="field">
            <span>{kind === 'flight' ? 'Aerolínea' : kind === 'hotel' ? 'Plataforma' : 'Proveedor'}</span>
            <input id={`q-p-${r.id}`} className="input" value={v.provider} maxLength={120} placeholder={kind === 'flight' ? 'Ej. Aerolínea' : kind === 'hotel' ? 'Ej. Sitio de reservas' : ''} onChange={(e) => set('provider', e.target.value, { provider: e.target.value })} />
          </label>
          {kind === 'flight' && (
            <label className="field">
              <span>N.º de vuelo</span>
              <input id={`q-f-${r.id}`} className="input mono" value={v.flightNo} maxLength={40} placeholder="Ej. B6 83" autoCapitalize="characters" onChange={(e) => set('flightNo', e.target.value.toUpperCase(), { flightNo: e.target.value.toUpperCase() })} />
            </label>
          )}
        </div>

        <label className="field">
          <span>Número de reserva</span>
          <div className="doc-row">
            <input id={`q-c-${r.id}`} className="input mono" value={v.confirmation} maxLength={80} placeholder="Ej. ABC123" autoCapitalize="characters" onChange={(e) => set('confirmation', e.target.value.toUpperCase(), { confirmation: e.target.value.toUpperCase() })} />
            <button type="button" className="btn icon" disabled={!v.confirmation} aria-label="Copiar" onClick={async () => toast((await copyText(v.confirmation)) ? 'Número copiado' : 'No se pudo copiar', 'success')}>
              <Copy size={16} />
            </button>
          </div>
        </label>

        <label className="field">
          <span>Enlace de la reserva</span>
          <input id={`q-u-${r.id}`} className="input" type="url" inputMode="url" placeholder="Pega aquí el enlace" value={v.url} aria-invalid={!validUrl(v.url)} onChange={(e) => (setV((s) => ({ ...s, url: e.target.value })), validUrl(e.target.value) && patch({ url: e.target.value }))} />
        </label>

        <div className="doc-field">
          <span className="doc-label">{kind === 'flight' ? 'Pases de abordar (fotos o PDF)' : 'Capturas o PDF'}</span>
          <AttachmentStrip r={r} addLabel={kind === 'flight' ? 'Añadir pase de abordar' : 'Añadir captura o PDF'} />
        </div>

        <button type="button" className="wz-more-fields" onClick={onMore}>
          Fechas, notas y estado <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
