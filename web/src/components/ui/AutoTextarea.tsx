import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Textarea de una línea que crece con el contenido (Enter no inserta saltos) y se reajusta al cambiar el ancho o cargar la fuente. */
export function AutoTextarea({ value, onChange, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    // border-box: sumar el borde para que no recorte la última línea
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  };

  useLayoutEffect(fit, [value]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      {...rest}
    />
  );
}
