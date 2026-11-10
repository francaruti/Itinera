import { motion } from 'framer-motion';
import { EXPENSE_CATEGORY_LABEL } from '../../../../shared/constants';
import { dayOfMonth } from '../../../../shared/time';
import type { ExpenseCategory } from '../../../../shared/types';
import { CATEGORY_COLOR } from '../../lib/budget';
import { money } from '../../lib/format';

export function Donut({ data }: { data: Array<[ExpenseCategory, number]> }) {
  const total = data.reduce((n, [, v]) => n + v, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" className="donut" role="img" aria-label="Gasto por categoría">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="26" />
        {data.map(([cat, v], i) => {
          const len = (v / total) * C;
          const offset = -acc;
          acc += len;
          return (
            <motion.circle
              key={cat}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={CATEGORY_COLOR[cat]}
              strokeWidth="26"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`}
              strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
              initial={{ opacity: 0, strokeDasharray: `0 ${C}` }}
              animate={{ opacity: 1, strokeDasharray: `${Math.max(len - 2, 0)} ${C}` }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
        <text x="100" y="96" textAnchor="middle" className="donut-total">
          {money(total)}
        </text>
        <text x="100" y="116" textAnchor="middle" className="donut-sub">
          gastado
        </text>
      </svg>
      <ul className="legend">
        {data.map(([cat, v]) => (
          <li key={cat}>
            <i style={{ background: CATEGORY_COLOR[cat] }} />
            <span>{EXPENSE_CATEGORY_LABEL[cat]}</span>
            <strong className="tnum">{Math.round((v / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayBars({ rows }: { rows: Array<{ date: string; spent: number; planned: number }> }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.planned)));
  const W = 100;
  const H = 120;
  const bw = W / rows.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="bars" preserveAspectRatio="none" role="img" aria-label="Gasto por día">
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        {rows.map((r, i) => {
          const hp = (r.planned / max) * (H - 6);
          const hs = (r.spent / max) * (H - 6);
          const x = i * bw + bw * 0.2;
          const w = bw * 0.6;
          return (
            <g key={r.date}>
              <title>{`${dayOfMonth(r.date)} oct · gastado ${money(r.spent)} · estimado ${money(r.planned)}`}</title>
              <motion.rect x={x} width={w} rx="1" fill="var(--fl-soft)" stroke="var(--fl-bright)" strokeWidth="0.4" strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" initial={{ y: H, height: 0 }} animate={{ y: H - hp, height: hp }} transition={{ delay: i * 0.04, duration: 0.6 }} />
              <motion.rect x={x} width={w} rx="1" fill="var(--accent)" initial={{ y: H, height: 0 }} animate={{ y: H - hs, height: hs }} transition={{ delay: 0.1 + i * 0.04, duration: 0.6 }} />
            </g>
          );
        })}
      </svg>
      <div className="bars-x" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}>
        {rows.map((r) => (
          <span key={r.date}>{dayOfMonth(r.date)}</span>
        ))}
      </div>
      <div className="legend inline">
        <span>
          <i style={{ background: 'var(--accent)' }} /> Gastado
        </span>
        <span>
          <i className="dashed" /> Estimado de actividades
        </span>
      </div>
    </div>
  );
}
