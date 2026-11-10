import { addDays } from '../../../shared/time';
import type { Activity, ChecklistItem, Day, Expense, Op, Reservation, Snapshot, Trip } from '../../../shared/types';

/** Reducer cliente: replica en memoria lo que el servidor hace con cada operación. */
export function applyOp(snap: Snapshot, op: Op): Snapshot {
  const data = (op.data ?? {}) as Record<string, unknown>;

  const upsert = <T extends { id: string }>(list: T[], full: boolean): T[] => {
    const i = list.findIndex((x) => x.id === op.id);
    if (op.action === 'delete') return i < 0 ? list : list.filter((x) => x.id !== op.id);
    if (op.action === 'put') {
      const next = { ...(i >= 0 && !full ? list[i] : {}), ...data, id: op.id } as T;
      return i >= 0 ? list.map((x, j) => (j === i ? next : x)) : [...list, next];
    }
    if (i < 0) return list;
    return list.map((x, j) => (j === i ? ({ ...x, ...data } as T) : x));
  };

  switch (op.entity) {
    case 'trip':
      return { ...snap, trip: { ...snap.trip, ...(data as Partial<Trip>) } };
    case 'day': {
      let days = snap.days;
      let activities = snap.activities;
      const i = days.findIndex((d) => d.date === op.id);
      if (op.action === 'delete') {
        days = days.filter((d) => d.date !== op.id);
        activities = activities.filter((a) => a.dayDate !== op.id);
      } else if (op.action === 'put') {
        const next = { travel: false, title: '', notes: '', ...data, date: op.id } as unknown as Day;
        days = i >= 0 ? days.map((d, j) => (j === i ? next : d)) : [...days, next].sort((a, b) => a.date.localeCompare(b.date));
      } else if (i >= 0) {
        days = days.map((d, j) => (j === i ? ({ ...d, ...data } as Day) : d));
      }
      return withDates({ ...snap, days, activities });
    }
    case 'activity':
      return { ...snap, activities: upsert<Activity>(snap.activities, true) };
    case 'checklist':
      return { ...snap, checklist: upsert<ChecklistItem>(snap.checklist, true) };
    case 'reservation':
      return {
        ...snap,
        reservations: upsert<Reservation>(snap.reservations, true),
        attachments: op.action === 'delete' ? snap.attachments.filter((a) => a.reservationId !== op.id) : snap.attachments,
      };
    case 'expense':
      return { ...snap, expenses: upsert<Expense>(snap.expenses, true) };
  }
}

export function applyOps(snap: Snapshot, ops: Op[]): Snapshot {
  return ops.reduce(applyOp, snap);
}

function withDates(snap: Snapshot): Snapshot {
  const days = snap.days;
  return { ...snap, trip: { ...snap.trip, startDate: days[0]?.date ?? '', endDate: days[days.length - 1]?.date ?? '' } };
}

/** Fusiona una operación nueva con la última pendiente de la cola cuando afectan a la misma entidad. */
export function coalesce(queue: Op[], op: Op, protectedCount: number): Op[] {
  const last = queue.length > protectedCount ? queue[queue.length - 1] : undefined;
  if (!last || last.entity !== op.entity || last.id !== op.id) return [...queue, op];
  if (op.action === 'patch' && (last.action === 'patch' || last.action === 'put')) {
    return [...queue.slice(0, -1), { ...last, data: { ...last.data, ...op.data } }];
  }
  if (op.action === 'delete' && last.action === 'put') return queue.slice(0, -1);
  return [...queue, op];
}

export const op = {
  trip: (data: Partial<Trip>): Op => ({ entity: 'trip', action: 'patch', id: 'trip', data }),
  day: {
    put: (d: Day): Op => ({ entity: 'day', action: 'put', id: d.date, data: stripKeys(d, ['date']) }),
    patch: (date: string, data: Partial<Day>): Op => ({ entity: 'day', action: 'patch', id: date, data }),
    del: (date: string): Op => ({ entity: 'day', action: 'delete', id: date }),
  },
  activity: {
    put: (a: Activity): Op => ({ entity: 'activity', action: 'put', id: a.id, data: stripKeys(a, ['id']) }),
    patch: (id: string, data: Partial<Activity>): Op => ({ entity: 'activity', action: 'patch', id, data }),
    del: (id: string): Op => ({ entity: 'activity', action: 'delete', id }),
  },
  checklist: {
    put: (c: ChecklistItem): Op => ({ entity: 'checklist', action: 'put', id: c.id, data: stripKeys(c, ['id']) }),
    patch: (id: string, data: Partial<ChecklistItem>): Op => ({ entity: 'checklist', action: 'patch', id, data }),
    del: (id: string): Op => ({ entity: 'checklist', action: 'delete', id }),
  },
  reservation: {
    put: (r: Reservation): Op => ({ entity: 'reservation', action: 'put', id: r.id, data: stripKeys(r, ['id']) }),
    patch: (id: string, data: Partial<Reservation>): Op => ({ entity: 'reservation', action: 'patch', id, data }),
    del: (id: string): Op => ({ entity: 'reservation', action: 'delete', id }),
  },
  expense: {
    put: (e: Expense): Op => ({ entity: 'expense', action: 'put', id: e.id, data: stripKeys(e, ['id']) }),
    patch: (id: string, data: Partial<Expense>): Op => ({ entity: 'expense', action: 'patch', id, data }),
    del: (id: string): Op => ({ entity: 'expense', action: 'delete', id }),
  },
};

function stripKeys<T extends object>(obj: T, keys: string[]): Record<string, unknown> {
  const out = { ...obj } as Record<string, unknown>;
  for (const k of keys) delete out[k];
  return out;
}

export { addDays };
