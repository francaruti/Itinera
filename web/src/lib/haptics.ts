/** Vibración breve en dispositivos que la soportan (Android); se ignora en el resto y con movimiento reducido. */
export function tap(ms = 8) {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(ms);
  } catch {
    /* sin soporte */
  }
}
export const success = () => {
  try {
    navigator.vibrate?.([10, 40, 14]);
  } catch {
    /* sin soporte */
  }
};
