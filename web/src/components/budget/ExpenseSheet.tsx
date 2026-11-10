import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EXPENSE_CATEGORY_LABEL } from '../../../../shared/constants';
import { DOW_ES, dayOfMonth, dowIndex, nowInZone } from '../../../../shared/time';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '../../../../shared/types';
import { CATEGORY_COLOR } from '../../lib/budget';
import { op } from '../../lib/ops';
import { uid } from '../../lib/uid';
import { useStore } from '../../store';
import { Sheet } from '../ui/Sheet';

interface Props {
  /** `null` cerrado, 'new' para crear, o el id de un gasto existente. */
  target: string | 'new' | null;
  onClose(): void;
}

export function ExpenseSheet({ target, onClose }: Props) {
  const snap = useStore((s) => s.snap)!;
  const dispatch = useStore((s) => s.dispatch);
  const toast = useStore((s) => s.toast);
  const removeWithUndo = useStore((s) => s.removeWithUndo);
  const existing = target && target !== 'new' ? snap.expenses.find((e) => e.id === target) : undefined;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState('');

  useEffect(() => {
    if (!target) return;
    if (existing) {
      setAmount(String(existing.amount));
      setDescription(existing.description);
      setCategory(existing.category);
      setDate(existing.date);
      setPaidBy(existing.paidBy);
    } else {
      const today = nowInZone(snap.trip.timezone).date;
      const inTrip = snap.days.some((d) => d.date === today);
      setAmount('');
      setDescription('');
      setCategory('food');
      setDate(inTrip ? today : useStore.getState().selectedDate);
      setPaidBy(snap.trip.travelers[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const n = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0 && description.trim().length > 0 && date !== '';

  function save() {
    if (!valid) return;
    const data: Expense = { id: existing?.id ?? uid(), date, description: description.trim(), category, amount: n, currency: 'USD', paidBy: paidBy.trim() };
    dispatch(op.expense.put(data));
    toast(existing ? 'Gasto actualizado' : 'Gasto registrado', 'success');
    onClose();
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={existing ? 'Editar gasto' : 'Registrar gasto'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="sheet-body">
          <div className="field">
            <span>Monto</span>
            <div className="row">
              <input className="input amount-input grow" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus aria-label="Monto" />
              <span className="muted small">USD</span>
            </div>
          </div>
          <label className="field">
            <span>Descripción</span>
            <input className="input" value={description} maxLength={200} placeholder="Ej. Cena en un restaurante" onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="field">
            <span>Categoría</span>
            <div className="row wrap">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c} type="button" className="chip pick" aria-pressed={category === c} onClick={() => setCategory(c)}>
                  <i className="cat-dot" style={{ background: CATEGORY_COLOR[c] }} /> {EXPENSE_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Día</span>
              <select className="select" value={date} onChange={(e) => setDate(e.target.value)}>
                {snap.days.map((d) => (
                  <option key={d.date} value={d.date}>
                    {DOW_ES[dowIndex(d.date)].slice(0, 3)} {dayOfMonth(d.date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Pagó</span>
              <input className="input" value={paidBy} list="travelers" maxLength={60} placeholder="Opcional" onChange={(e) => setPaidBy(e.target.value)} />
              <datalist id="travelers">
                {snap.trip.travelers.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
          </div>
        </div>
        <div className="sheet-foot">
          {existing ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                onClose();
                removeWithUndo('Gasto eliminado', op.expense.del(existing.id), op.expense.put(existing));
              }}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn accent" disabled={!valid}>
            {existing ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
