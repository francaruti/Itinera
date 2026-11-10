import { CITY_META } from '../../../shared/constants';
import { formatTime12, longDate } from '../../../shared/time';
import { dayActivities } from '../lib/selectors';
import { useStore } from '../store';

export default function PrintView() {
  const snap = useStore((s) => s.snap);
  if (!snap) return null;
  return (
    <div className="print-only">
      <h1>{snap.trip.name}</h1>
      <p>
        {longDate(snap.trip.startDate)} – {longDate(snap.trip.endDate)}
      </p>
      {snap.days.map((d) => (
        <section key={d.date} className="print-day">
          <h2>
            {longDate(d.date)} · {CITY_META[d.city].name}
          </h2>
          {d.title && <p className="print-title">{d.title}</p>}
          <ul>
            {dayActivities(snap, d.date).map((a) => (
              <li key={a.id}>
                <span className="print-time">{a.time ? formatTime12(a.time) : '—'}</span>
                <span>
                  {a.text}
                  {a.place && <em> — {a.place}</em>}
                </span>
              </li>
            ))}
          </ul>
          {d.notes && <p className="print-notes">{d.notes}</p>}
        </section>
      ))}
      <section className="print-day">
        <h2>Reservas</h2>
        <ul>
          {snap.reservations.map((r) => (
            <li key={r.id}>
              <span className="print-time">{r.startsAt.slice(5, 10)}</span>
              <span>
                {r.title}
                {(r.provider || r.flightNo) && ` · ${[r.provider, r.flightNo].filter(Boolean).join(' ')}`}
                {r.confirmation && ` · Código ${r.confirmation}`}
                {r.status !== 'booked' && ' · (por resolver)'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
