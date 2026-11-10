import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { photoUrl, shortAuthor, type PhotoInfo, type PhotoWidth } from '../../lib/photos';
import { useStore } from '../../store';

interface Props {
  photo: PhotoInfo;
  /** Ancho de miniatura a pedir (se limita al tamaño original). */
  width?: PhotoWidth;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** Cargar de inmediato (imágenes visibles al abrir). */
  eager?: boolean;
  /** Abre el visor a pantalla completa al tocar. */
  zoom?: boolean;
  /** Zoom lento continuo ("Ken Burns"). */
  kenburns?: boolean;
  /** Muestra el crédito del autor sobre la imagen. */
  credit?: boolean;
}

export function PhotoCredit({ photo, className = '' }: { photo: PhotoInfo; className?: string }) {
  return (
    <a
      className={`photo-credit ${className}`}
      href={photo.page}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${photo.author} · ${photo.license} · Wikimedia Commons`}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="currentColor" />
      </svg>
      {shortAuthor(photo)} · {photo.license}
    </a>
  );
}

/** Imagen con carga progresiva: shimmer → fundido; si falla, se oculta sin romper el diseño. */
export function Photo({ photo, width = 960, alt, className = '', style, eager, zoom, kenburns, credit }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const img = useRef<HTMLImageElement>(null);
  const openPhoto = useStore((s) => s.openPhoto);

  useEffect(() => {
    setState('loading');
    const el = img.current;
    if (el?.complete && el.naturalWidth > 0) setState('ready');
  }, [photo.key, width]);

  if (state === 'error') return <span className={`photo photo-error ${className}`} style={style} aria-hidden="true" />;

  const open = zoom ? () => openPhoto(photo.key) : undefined;
  return (
    <span
      className={`photo ${state}${kenburns ? ' kb' : ''}${zoom ? ' zoomable' : ''} ${className}`}
      style={style}
      onClick={open}
      role={zoom ? 'button' : undefined}
      tabIndex={zoom ? 0 : undefined}
      aria-label={zoom ? `Ampliar foto: ${alt ?? photo.name}` : undefined}
      onKeyDown={zoom ? (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), open?.()) : undefined) : undefined}
    >
      <img
        ref={img}
        src={photoUrl(photo, width)}
        alt={alt ?? photo.name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
      {credit && state === 'ready' && <PhotoCredit photo={photo} />}
    </span>
  );
}
