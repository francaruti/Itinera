import type { ExpenseCategory, Snapshot } from '../../../shared/types';

export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: '#f59e0b',
  transport: '#64748b',
  lodging: '#8b5cf6',
  tickets: '#2f6bff',
  shopping: '#14b8a6',
  show: '#ec4899',
  tech: '#6366f1',
  other: '#9ca3af',
};

/** Todo el presupuesto está en USD: los importes de gastos y reservas se suman tal cual. */
export function budgetSummary(snap: Snapshot) {
  const spent = snap.expenses.reduce((n, e) => n + e.amount, 0);
  const reservations = snap.reservations.reduce((n, r) => n + (r.amount ?? 0), 0);
  const planned = snap.activities.reduce((n, a) => n + (a.cost ?? 0), 0);
  const budget = snap.trip.budgetUsd;

  const byCategory = new Map<ExpenseCategory, number>();
  const byDay = new Map<string, { spent: number; planned: number }>();
  for (const d of snap.days) byDay.set(d.date, { spent: 0, planned: 0 });
  for (const e of snap.expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    const row = byDay.get(e.date);
    if (row) row.spent += e.amount;
  }
  for (const a of snap.activities) {
    const row = byDay.get(a.dayDate);
    if (row) row.planned += a.cost ?? 0;
  }
  const byPerson = new Map<string, number>();
  for (const e of snap.expenses) {
    const who = e.paidBy || 'Sin asignar';
    byPerson.set(who, (byPerson.get(who) ?? 0) + e.amount);
  }
  return { spent, reservations, planned, budget, byCategory, byDay, byPerson, committed: reservations + planned };
}
