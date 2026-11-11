import { useEffect, useState } from 'react';
import { cityMeta, destinosConocidos, registrarDestinos } from '../../../shared/constants';
import type { GeocodeResult } from '../../../shared/types';
import { api, NetworkError } from '../lib/api';

/**
 * Elige el destino de un día o una reserva buscando cualquier ciudad o lugar del mundo.
 * Al elegir un resultado, el lugar se guarda en el viaje y queda disponible para todos los días.
 */
export function DestinoPicker({ value, onChange }: { value: string; onChange: (clave: string) => void }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<GeocodeResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 3) {
      setResultados([]);
      setAviso('');
      return;
    }
    let vivo = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontrados = await api.geocode(termino);
        if (!vivo) return;
        setResultados(encontrados);
        setAviso(encontrados.length ? '' : 'No encontramos ese lugar. Prueba con otro nombre.');
      } catch (err) {
        if (!vivo) return;
        setResultados([]);
        setAviso(err instanceof NetworkError ? 'Sin conexión para buscar.' : 'No se pudo buscar ahora. Inténtalo de nuevo.');
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [q]);

  async function elegir(r: GeocodeResult) {
    const nombre = (r.name || r.label.split(',')[0] || r.label).trim().slice(0, 80);
    setGuardando(true);
    try {
      const res = await api.createDestino({ name: nombre, label: r.label, lat: r.lat, lng: r.lng });
      registrarDestinos({ [res.key]: res.meta });
      onChange(res.key);
      setQ('');
      setResultados([]);
      setAviso('');
    } catch {
      setAviso('No se pudo guardar ese destino. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="destino">
      <p className="destino-actual">
        Destino actual: <strong>{cityMeta(value).name}</strong>
      </p>
      <input
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Busca una ciudad o lugar, por ejemplo Roma, Italia"
        aria-label="Buscar destino"
        autoComplete="off"
        maxLength={120}
      />
      {buscando && <small className="muted">Buscando…</small>}
      {aviso && <small className="muted">{aviso}</small>}
      {resultados.length > 0 && (
        <ul className="destino-resultados">
          {resultados.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="destino-opcion" onClick={() => void elegir(r)} disabled={guardando}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="destino-conocidos" aria-label="Destinos del viaje">
        {destinosConocidos().map(([clave, meta]) => (
          <button
            key={clave}
            type="button"
            className="destino-chip"
            aria-pressed={clave === value}
            onClick={() => onChange(clave)}
          >
            {meta.name}
          </button>
        ))}
      </div>
    </div>
  );
}
