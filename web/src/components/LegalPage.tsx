import { ArrowLeft } from 'lucide-react';
import { plantilla } from '../../../shared/plantilla';
import { precioTexto } from '../lib/ventas';

export type LegalKind = 'privacidad' | 'terminos';

/** Tipo de página legal de una dirección (#/legal/privacidad o #/legal/terminos), o null. */
export function legalFromHash(hash: string): LegalKind | null {
  const m = /^#\/legal\/(privacidad|terminos)\/?$/.exec(hash);
  return m ? (m[1] as LegalKind) : null;
}

function Privacidad() {
  return (
    <>
      <h1>Privacidad</h1>
      <h2>Responsable del tratamiento</h2>
      <ul>
        <li>Titular: Francesca Caruti</li>
        <li>Domicilio: Ermitagaña 7, Pamplona</li>
        <li>Contacto: {plantilla.contactoEmail}</li>
        <li>Ley aplicable: derecho español</li>
      </ul>

      <h2>Quién decide sobre tus datos</h2>
      <p>Los datos del viaje se guardan en el servidor que instala la persona que usa la app. Esa persona decide qué datos guarda, quién entra y durante cuánto tiempo los conserva. El titular de esta app no tiene acceso a esos datos.</p>

      <h2>Qué datos se guardan</h2>
      <ul>
        <li>En el servidor que instales (SQLite o Postgres): el plan del viaje (días, horas, actividades, lugares y notas), las reservas que escribas, los pendientes, los gastos y los archivos que subas.</li>
        <li>Si la app tiene código de acceso: el correo de cada persona autorizada y su contraseña, que se guarda cifrada y nunca en texto.</li>
        <li>En el navegador de cada dispositivo: una copia del último estado del viaje y los cambios pendientes de enviar. Si abriste el viaje con conexión antes, esa copia permite verlo sin red.</li>
      </ul>

      <h2>Servicios externos</h2>
      <ul>
        <li>Open-Meteo: tu servidor consulta el pronóstico con las coordenadas de los destinos.</li>
        <li>Nominatim (OpenStreetMap): tu servidor recibe el texto que buscas para ubicar un lugar.</li>
        <li>FOSSGIS (OpenStreetMap): tu servidor pide las rutas con las coordenadas de los puntos.</li>
        <li>Teselas de OpenStreetMap y ArcGIS (vista satelital): tu navegador descarga las imágenes de la zona del mapa que ves.</li>
        <li>Ubicación: si tocas «Ir a mi ubicación», el navegador pide permiso. La posición se usa en el mapa y, si calculas una ruta, se envía a FOSSGIS como se indica arriba.</li>
      </ul>

      <p>Algunos de estos servicios pueden estar fuera de la Unión Europea. Al consultarlos se envían datos técnicos, como la dirección IP. Cada proveedor explica en su política cómo trata esos datos.</p>

      <h2>Lo que no incluye la plantilla</h2>
      <p>No incluye publicidad, analítica ni rastreo. Si añades alguno, actualiza esta página.</p>

      <h2>Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación, supresión, oposición o portabilidad de tus datos escribiendo a {plantilla.contactoEmail}. Si consideras que tus derechos no se respetan, puedes presentar una reclamación ante la autoridad de protección de datos de tu país.</p>

      <h2>Conservación</h2>
      <p>Los datos se conservan hasta que los borres en la app o hasta que la persona administradora elimine tu acceso. Los datos del navegador se borran al limpiar los datos del sitio.</p>

      <p>Texto modelo: revísalo y adáptalo a tus servicios y a la ley de tu país antes de publicar la app.</p>
    </>
  );
}

function Terminos() {
  return (
    <>
      <h1>Términos de uso</h1>
      <h2>Qué es</h2>
      <p>
        {plantilla.nombre} es una herramienta para organizar un viaje: itinerario, mapa, reservas, pendientes, presupuesto y clima. Los horarios, precios, clima y rutas
        que muestra son orientativos y pueden cambiar: confírmalos en las fuentes oficiales.
      </p>

      <h2>Acceso</h2>
      <ul>
        <li>Si la app tiene código de acceso, cada persona entra con su correo y su contraseña. No compartas tu contraseña ni el código de invitación fuera del grupo del viaje.</li>
        <li>Cada persona es responsable de los datos que escribe y sube.</li>
      </ul>

      <h2>Reservas y pagos</h2>
      <p>
        La app guarda tus notas, códigos y comprobantes. Mientras no tenga cobros conectados, no cobra nada ni procesa pagos: las reservas y los pagos se hacen con cada
        proveedor.
      </p>

      <h2>Prueba gratuita</h2>
      <p>
        La prueba dura {plantilla.pruebaDias} días y no tiene costo. Al terminar, se cobra el plan que hayas elegido: {precioTexto(plantilla.precios.mensual)} al mes o{' '}
        {precioTexto(plantilla.precios.anual)} al año, en dólares. Al empezar la prueba con tus datos de pago, aceptas estas condiciones y sabes que el cobro será
        automático al terminar la prueba.
      </p>
      <p>Puedes cancelar cuando quieras; la cancelación se tramita con Hotmart y evita los cobros siguientes.</p>

      <h2>Garantía de {plantilla.garantiaDias} días</h2>
      <p>
        Esta garantía solo aplica si quien vende la app cobra por Hotmart. Entonces, el cobro y el reembolso los gestiona Hotmart: una solicitud dentro de los{' '}
        {plantilla.garantiaDias} días siguientes a la compra se tramita con Hotmart, y esta app no tiene otro proceso de reembolso. Mientras la app no cobre por Hotmart,
        esta sección no aplica.
      </p>
      <p>Además de esta garantía, conservas los derechos de desistimiento que te reconozca la ley de tu país.</p>

      <h2>Responsabilidad</h2>
      <p>
        Revisa las reservas, los horarios y los documentos de viaje antes de salir. En la medida que permita la ley, el titular de la app no responde por las decisiones de
        viaje tomadas con su información.
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por el derecho español, sin perjuicio de los derechos que la normativa imperativa de tu país de residencia te reconozca como consumidor.</p>

      <p>Texto modelo: revísalo con asesoría legal de tu país antes de publicar la app.</p>
    </>
  );
}

/** Páginas legales de la app. Son públicas (también antes de entrar) y leen nombre y contacto de shared/plantilla.ts. */
export function LegalPage({ kind }: { kind: LegalKind }) {
  return (
    <main className="legal" id="main">
      <a className="legal-back" href="#/itinerario">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a la app
      </a>
      {kind === 'privacidad' ? <Privacidad /> : <Terminos />}
      <footer className="legal-foot">
        <small className="muted">
          © {plantilla.anioCopyright} {plantilla.nombre} · <a href="#/legal/privacidad">Privacidad</a> · <a href="#/legal/terminos">Términos</a>
        </small>
      </footer>
    </main>
  );
}
