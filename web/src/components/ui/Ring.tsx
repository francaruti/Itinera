import { motion } from 'framer-motion';

interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}

export function Ring({ value, size = 64, stroke = 7, label, color = 'var(--fl-bright)' }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ ['--size' as string]: `${size}px` }} role="img" aria-label={`${Math.round(pct * 100)}% completado`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 1 ? 'var(--ok)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-label">{label ?? `${Math.round(pct * 100)}%`}</div>
    </div>
  );
}
