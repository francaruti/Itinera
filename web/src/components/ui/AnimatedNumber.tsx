import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}

/** Cuenta de forma animada hasta `value` cada vez que cambia. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 0.9 }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      from.current = shown;
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <span className="tnum">{format(shown)}</span>;
}
