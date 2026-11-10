/**
 * Centra un elemento dentro de una tira con desplazamiento horizontal (días del viaje, días del clima).
 * Solo mueve la tira: scrollIntoView también desplazaba la página en vertical al abrir la app
 * y dejaba tapadas las tarjetas de arriba bajo la cabecera.
 */
export function centrarEnTira(tira: HTMLElement | null | undefined, el: HTMLElement | null | undefined, behavior: ScrollBehavior = 'smooth'): void {
  if (!tira || !el) return;
  const t = tira.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const delta = e.left + e.width / 2 - (t.left + t.width / 2);
  if (Math.abs(delta) < 1) return;
  tira.scrollBy({ left: delta, behavior });
}
