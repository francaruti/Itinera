import { motion } from 'framer-motion';
import { tap } from '../../lib/haptics';

export function CheckCircle({ checked, onChange, label, size = 24 }: { checked: boolean; onChange(next: boolean): void; label: string; size?: number }) {
  return (
    <button type="button" className="check" role="checkbox" aria-checked={checked} aria-label={label} onClick={() => {
        tap();
        onChange(!checked);
      }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <motion.circle cx="12" cy="12" r="10" className="check-ring" animate={{ fill: checked ? 'var(--ok)' : 'rgba(0,0,0,0)' }} style={{ stroke: checked ? 'var(--ok)' : undefined }} transition={{ duration: 0.2 }} />
        <motion.path
          d="M7 12.5l3.2 3.2L17 9"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.28 }}
        />
      </svg>
    </button>
  );
}
