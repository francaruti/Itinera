import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Pencil, Plus, Receipt, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EXPENSE_CATEGORY_LABEL } from '../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex } from '../../../shared/time';
import type { ExpenseCategory } from '../../../shared/types';
import { Donut, DayBars } from '../components/budget/Charts';
import { ExpenseSheet } from '../components/budget/ExpenseSheet';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Sheet } from '../components/ui/Sheet';
import { CATEGORY_COLOR, budgetSummary } from '../lib/budget';
import { money } from '../lib/format';
import { op } from '../lib/ops';
import { useStore } from '../store';

function Stat({ label, usd, tone, hint }: { label: string; usd: number; tone?: string; hint?: string }) {
  return (
    <div className={`stat big ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>
        <AnimatedNumber value={usd} format={(n) => money(Math.round(n * 100) / 100)} />
      </strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function BudgetEditor({ open, onClose }: { open: boolean; onClose(): void }) {
  const trip = useStore((s) => s.snap!.trip);
  const dispatch = useStore((s) => s.dispatch);
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState('');

  useEffect(() => {
    if (!open) return;
    setBudget(String(trip.budgetUsd || ''));
    setPeople(trip.travelers.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    const b = Number(budget.replace(',', '.') || 0);
    if (!Number.isFinite(b) || b < 0) return;
    const travelers = people.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 12);
    dispatch(op.trip({ budgetUsd: b, travelers }));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Presupuesto y viajeros">
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="sheet-body">
          <label className="field">
            <span>Presupuesto total (USD)</span>
            <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ej. 4000" data-autofocus />
          </label>
          <label className="field">
            <span>Viajeros (separados por coma)</span>
            <input className="input" value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Ej. Ana, Luis" />
          </label>
        </div>
        <div className="sheet-foot" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn">Guardar</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function BudgetView() {
  const snap = useStore((s) => s.snap)!;
  const [sheet, setSheet] = useState<string | 'new' | null>(null);
  const [editBudget, setEditBudget] = useState(false);

  const sum = useMemo(() => budgetSummary(snap), [snap]);
  const { spent, budget, committed } = sum;
  const available = budget - spent;
  const pct = budget > 0 ? spent / budget : 0;
  const projected = budget > 0 ? (spent + committed) / budget : 0;

  const cats = [...sum.byCategory.entries()].sort((a, b) => b[1] - a[1]) as Array<[ExpenseCategory, number]>;
  const rows = snap.days.map((d) => ({ date: d.date, ...sum.byDay.get(d.date)! }));
  const byDate = useMemo(() => {
    const m = new Map<string, typeof snap.expenses>();
    for (const e of [...snap.expenses].reverse()) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [snap]);

  // Sin presupuesto ni gastos: una sola tarjeta con la acción principal, sin cifras en cero.
  const blank = budget === 0 && snap.expenses.length === 0;
  const tone = budget === 0 ? '' : pct > 1 ? 'danger' : pct > 0.85 ? 'warn' : 'ok';

  return (
    <div className="container">
      <header className="view-head">
        <div>
          <h1 className="display view-title">Presupuesto</h1>
          <p className="muted">Gastos frente a tu presupuesto · USD</p>
        </div>
        <div className="view-head-side">
          <button className="btn ghost" onClick={() => setEditBudget(true)}>
            <Pencil size={16} /> Ajustar
          </button>
          <button className="btn accent" onClick={() => setSheet('new')}>
            <Plus size={18} /> Registrar gasto
          </button>
        </div>
      </header>

      {blank ? (
        <section className="card empty-budget">
          <div className="empty-state">
            <Wallet />
            <strong>Aún no hay presupuesto ni gastos</strong>
            <span>
              {committed > 0
                ? `Ya hay ${money(committed)} comprometidos en reservas y planes. Define cuánto quieres gastar para ver cuánto te queda.`
                : 'Define cuánto quieres gastar para ver cuánto te queda, o registra el primer gasto.'}
            </span>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <button className="btn accent" onClick={() => setEditBudget(true)}>
                <Wallet size={16} /> Definir presupuesto
              </button>
              <button className="btn" onClick={() => setSheet('new')}>
                <Plus size={16} /> Registrar gasto
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
      <div className="stat-grid">
        <Stat label="Presupuesto" usd={budget} />
        <Stat label="Gastado" usd={spent} tone={tone} />
        <Stat label="Disponible" usd={budget > 0 ? available : 0} tone={budget > 0 && available < 0 ? 'danger' : ''} hint={budget === 0 ? 'Define un presupuesto para calcularlo' : undefined} />
        <Stat label="Comprometido" usd={committed} hint="Reservas con monto + actividades estimadas" />
      </div>

      <section className="card budget-bar">
        {budget === 0 ? (
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <p className="muted">Define un presupuesto total para ver cuánto te queda.</p>
            <button className="btn sm" onClick={() => setEditBudget(true)}>
              <Wallet size={15} /> Definir presupuesto
            </button>
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong className="h-stretch">{Math.round(pct * 100)}% gastado</strong>
              <small className="muted">Proyección con lo comprometido: {Math.round(projected * 100)}%</small>
            </div>
            <div className={`bar-track thick ${tone}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Presupuesto gastado">
              <div className="bar-proj" style={{ width: `${Math.min(projected, 1) * 100}%` }} />
              <motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 1) * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </>
        )}
      </section>

      <div className="two-col">
        <section className="card">
          <h2 className="card-title h-stretch">Por categoría</h2>
          {cats.length === 0 ? (
            <div className="empty-state">
              <Banknote />
              <strong>Aún no hay gastos</strong>
              <span>Registra el primero para ver el desglose.</span>
            </div>
          ) : (
            <Donut data={cats} />
          )}
        </section>
        <section className="card">
          <h2 className="card-title h-stretch">Por día</h2>
          <DayBars rows={rows} />
          {sum.byPerson.size > 1 || (sum.byPerson.size === 1 && !sum.byPerson.has('Sin asignar')) ? (
            <div className="people-split">
              {[...sum.byPerson.entries()].map(([who, usd]) => (
                <span key={who} className="chip">
                  {who}: {money(usd)}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="card">
        <h2 className="card-title h-stretch">
          <Receipt size={18} /> Gastos <span className="chip">{snap.expenses.length}</span>
        </h2>
        {snap.expenses.length === 0 ? (
          <div className="empty-state">
            <Receipt />
            <strong>Sin gastos todavía</strong>
            <span>Cuando empiece el viaje, anótalos aquí en segundos.</span>
          </div>
        ) : (
          <div className="exp-groups">
            <AnimatePresence initial={false}>
              {byDate.map(([date, list]) => (
                <motion.div key={date} layout className="exp-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <h3>
                    {DOW_ES[dowIndex(date)]} {dayOfMonth(date)}
                    <small className="tnum">{money(list.reduce((n, e) => n + e.amount, 0))}</small>
                  </h3>
                  <ul>
                    {list.map((e) => (
                      <motion.li key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <button className="exp-row" onClick={() => setSheet(e.id)}>
                          <i className="cat-dot lg" style={{ background: CATEGORY_COLOR[e.category] }} />
                          <span className="exp-text">
                            <strong>{e.description}</strong>
                            <small>
                              {EXPENSE_CATEGORY_LABEL[e.category]}
                              {e.paidBy && ` · ${e.paidBy}`}
                            </small>
                          </span>
                          <span className="exp-amt tnum">
                            {money(e.amount)}
                          </span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
        </>
      )}

      <ExpenseSheet target={sheet} onClose={() => setSheet(null)} />
      <BudgetEditor open={editBudget} onClose={() => setEditBudget(false)} />
    </div>
  );
}
