import { useEffect, useState, type FormEvent } from 'react';
import { addDays, longDate } from '../../../../shared/time';
import type { City } from '../../../../shared/types';
import { op } from '../../lib/ops';
import { useStore } from '../../store';
import { DestinoPicker } from '../DestinoPicker';
import { Sheet } from '../ui/Sheet';

/** Editar la ciudad / tipo del día, o añadir un día nuevo en cualquier fecha. */
export default function DaySheet() {
  const snap = useStore((s) => s.snap)!;
  const state = useStore((s) => s.daySheet);
  const close = useStore((s) => s.openDaySheet);
  const dispatch = useStore((s) => s.dispatch);
  const selectDate = useStore((s) => s.selectDate);
  const toast = useStore((s) => s.toast);

  const [date, setDate] = useState('');
  const [city, setCity] = useState<City>('ny');
  const [travel, setTravel] = useState(false);
  const [title, setTitle] = useState('');

  const editing = state?.mode === 'edit';
  const current = snap.days.find((d) => d.date === state?.date);

  useEffect(() => {
    if (!state) return;
    if (state.mode === 'edit' && current) {
      setDate(current.date);
      setCity(current.city);
      setTravel(current.travel);
      setTitle(current.title);
    } else {
      const last = snap.days[snap.days.length - 1];
      setDate(last ? addDays(last.date, 1) : '');
      setCity(last?.city ?? 'ny');
      setTravel(false);
      setTitle('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const taken = !editing && snap.days.some((d) => d.date === date);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !taken;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (editing) {
      dispatch(op.day.patch(date, { city, travel }));
      toast('Día actualizado', 'success');
    } else {
      dispatch(op.day.put({ date, city, travel, title: title.trim(), notes: '' }));
      selectDate(date);
      toast(`Día añadido: ${longDate(date)}`, 'success');
    }
    close(null);
  }

  return (
    <Sheet open={!!state} onClose={() => close(null)} title={editing ? 'Editar día' : 'Añadir día'}>
      <form onSubmit={submit}>
        <div className="sheet-body">
          {editing ? (
            <p className="muted">{longDate(date)}</p>
          ) : (
            <label className="field">
              <span>Fecha</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={taken} data-autofocus />
              {taken && <small className="field-error">Ese día ya existe en el viaje.</small>}
              {valid && <small className="muted">{longDate(date)}</small>}
            </label>
          )}

          <div className="field">
            <span>Ciudad</span>
            <DestinoPicker value={city} onChange={(clave) => setCity(clave as City)} />
            <small className="muted">Define el clima, el mapa y el color del día. Las actividades conservan sus ubicaciones.</small>
          </div>

          {!editing && (
            <label className="field">
              <span>Título (opcional)</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="¿Qué haremos este día?" />
            </label>
          )}

          <label className="check-line">
            <input type="checkbox" checked={travel} onChange={(e) => setTravel(e.target.checked)} />
            <span>Es un día de viaje (vuelo o traslado entre ciudades)</span>
          </label>
        </div>
        <div className="sheet-foot" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={() => close(null)}>
            Cancelar
          </button>
          <button type="submit" className="btn accent" disabled={!valid}>
            {editing ? 'Guardar' : 'Añadir día'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
