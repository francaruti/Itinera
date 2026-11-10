import { MapPinPlus, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Activity } from '../../../../shared/types';
import { guessCategory } from '../../lib/guess';
import { parseQuickAdd } from '../../lib/format';
import { op } from '../../lib/ops';
import { positionForTime } from '../../lib/selectors';
import { uid } from '../../lib/uid';
import { useStore } from '../../store';

/** Añadir un plan: la acción principal es buscar un lugar; escribir uno a mano queda a un toque (menos opciones a la vez). */
export function QuickAdd({ date, acts }: { date: string; acts: Activity[] }) {
  const dispatch = useStore((s) => s.dispatch);
  const openAddPlace = useStore((s) => s.openAddPlace);
  const [value, setValue] = useState('');
  const [typing, setTyping] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const { time, text } = parseQuickAdd(value);
    if (!text) return;
    dispatch(
      op.activity.put({
        id: uid(),
        dayDate: date,
        position: positionForTime(acts, time),
        time,
        text,
        done: false,
        category: guessCategory(text),
        place: '',
        lat: null,
        lng: null,
        cost: null,
        booking: 'none',
        url: '',
        notes: '',
      }),
    );
    setValue('');
  }

  return (
    <div className="add-plan">
      <div className="add-plan-row">
        <button className="btn accent" type="button" onClick={() => openAddPlace({ date })}>
          <MapPinPlus size={17} /> Buscar y añadir lugar
        </button>
        {!typing && (
          <button className="btn ghost" type="button" onClick={() => setTyping(true)}>
            <Plus size={17} /> Escribir plan
          </button>
        )}
      </div>
      {typing && (
        <form className="quick-add" onSubmit={submit}>
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={500}
            placeholder="Ej. 14:30 Almuerzo en el centro"
            aria-label="Nueva actividad"
            autoFocus
          />
          <button className="btn" type="submit" disabled={!value.trim()}>
            Añadir
          </button>
        </form>
      )}
    </div>
  );
}
