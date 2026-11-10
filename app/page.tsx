const trips = [
  {
    id: "1",
    name: "Escapada a Lisboa",
    dates: "12 – 15 de marzo",
    stops: 4,
  },
  {
    id: "2",
    name: "Ruta por Andalucía",
    dates: "2 – 9 de mayo",
    stops: 6,
  },
];

export default function Home() {
  return (
    <main>
      <h1>Itinera</h1>
      <p className="subtitle">Tus itinerarios de viaje</p>

      {trips.map((trip) => (
        <section className="card" key={trip.id}>
          <h2>{trip.name}</h2>
          <p>
            {trip.dates} · {trip.stops} paradas
          </p>
        </section>
      ))}

      <button className="button" type="button">
        Nuevo itinerario
      </button>
    </main>
  );
}
