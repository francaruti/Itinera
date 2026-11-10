import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}
interface Props<T extends string> {
  value: T;
  options: Option<NoInfer<T>>[];
  onChange(v: T): void;
  label?: string;
}

/** Control segmentado con indicador animado. */
export function Seg<T extends string>({ value, options, onChange, label }: Props<T>) {
  const id = useId();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
