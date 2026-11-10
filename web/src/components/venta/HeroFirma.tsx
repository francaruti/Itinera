import { DATO_HERO, tramosFirma } from '../../lib/ventas';
import { APP_NAME } from '../../../../shared/constants';

/**
 * Visual del héroe: mapa estilizado con la ruta punteada y sus kilómetros, la captura real del itinerario
 * dentro de un dispositivo que se funde abajo, y una tarjeta con el dato del día de esa captura.
 * Coordenadas en un lienzo de 400 × 540 (proporción fija). Los kilómetros salen de las coordenadas de CITY_META.
 */
export function HeroFirma() {
  const [tramoA, tramoB] = tramosFirma();
  return (
    <div className="venta-visual">
      <svg className="venta-mapa" viewBox="0 0 400 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect className="venta-mapa-tierra" x="0" y="0" width="400" height="540" rx="28" />
        <path className="venta-mapa-agua" d="M330 0H400V92C382 70 356 62 330 0Z" />
        <path className="venta-mapa-calle" d="M0 150H400M0 300H400M96 0V540M300 0V540" />
        <rect className="venta-mapa-manzana" x="18" y="170" width="54" height="78" rx="8" />
        <rect className="venta-mapa-manzana" x="18" y="312" width="62" height="54" rx="8" />
        <rect className="venta-mapa-manzana" x="326" y="170" width="56" height="58" rx="8" />
        <path className="venta-ruta" d="M64 30Q200 -10 336 120C372 220 372 320 300 380Q200 410 56 380" />
        <g className="venta-pin">
          <circle cx="64" cy="30" r="9" />
          <circle cx="336" cy="120" r="9" />
          <circle cx="56" cy="380" r="9" />
        </g>
        <g className="venta-km">
          <rect x="160" y="9" width="80" height="26" rx="13" />
          <text x="200" y="22">{`${tramoA.km} km`}</text>
        </g>
        <g className="venta-km">
          <rect x="316" y="227" width="80" height="26" rx="13" />
          <text x="356" y="240">{`${tramoB.km} km`}</text>
        </g>
      </svg>

      <div className="venta-device">
        <div className="venta-shot-wrap">
          <img
            src="/landing/itinerario-hero.webp"
            width={780}
            height={980}
            alt={`Pantalla principal de la app ${APP_NAME}`}
            fetchPriority="high"
            decoding="async"
          />
          <span className="venta-veladura" aria-hidden="true" />
        </div>
      </div>

      <aside className="venta-card" aria-label="Dato del día">
        <p className="venta-card-dia">{DATO_HERO.dia}</p>
        <p className="venta-card-linea">
          <strong>{DATO_HERO.hora}</strong> · {DATO_HERO.linea}
        </p>
      </aside>
    </div>
  );
}
