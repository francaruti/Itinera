import { useEffect } from 'react';

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

/** Atajo de teclado global. `allowTyping` permite activarlo dentro de campos de texto. */
export function useHotkey(
  match: (e: KeyboardEvent) => boolean,
  handler: (e: KeyboardEvent) => void,
  opts: { allowTyping?: boolean } = {},
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!opts.allowTyping && isTyping(e.target)) return;
      if (match(e)) handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}
