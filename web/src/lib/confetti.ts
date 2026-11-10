import confetti from 'canvas-confetti';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#2f6bff', '#5b9dff', '#38bdf8', '#1a3fb8', '#ffffff'];

export function celebrate(origin?: { x: number; y: number }) {
  if (reduced()) return;
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 300 };
  confetti({ ...base, particleCount: 90, spread: 75, startVelocity: 42, origin: origin ?? { x: 0.5, y: 0.7 } });
  setTimeout(() => confetti({ ...base, particleCount: 50, spread: 110, startVelocity: 28, origin: origin ?? { x: 0.5, y: 0.7 } }), 180);
}
