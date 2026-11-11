# Mi Itinerario · plantilla

Planificador de viaje: itinerario día a día, mapa, reservas, pendientes y maleta, presupuesto, clima e información útil. Si abriste el viaje con conexión antes, el itinerario se ve sin red con la última copia guardada en el navegador. El mapa solo muestra las zonas que ya cargaste.

**No hay ningún servicio de pago, correo ni IA conectado.** Los datos se guardan en tu servidor (SQLite por defecto, Postgres si lo defines). La app consulta servicios públicos sin clave para el clima, la búsqueda de lugares, las rutas y el mapa; la política de privacidad los describe.

## Cliente ideal y momento «ajá»

- **Cliente ideal:** una persona o una pareja que organiza un viaje de varios días y tiene los planes, las reservas y los gastos repartidos entre chats, correos y notas.
- **Momento «ajá»:** cuando ve cada día con sus planes, las reservas que faltan por resolver y lo gastado, todo en la misma pantalla.

## Pantallas

Sin sesión, la portada (`#/`) es la página de venta, con o sin `ACCESS_CODE`: «Empezar mi viaje» abre un onboarding de tres pasos (`#/empezar`). Con `ACCESS_CODE`, «Ya tengo acceso» y el último paso van a `#/acceso`, donde la primera pantalla pide correo y contraseña (el primer ingreso crea la contraseña con el código de invitación). Sin `ACCESS_CODE`, van directo a `#/itinerario`. Después: **Itinerario**, **Mapa**, **Clima**, **Reservas**, **Pendientes**, **Presupuesto**, **Info** y **Ajustes**. Las páginas legales están en `#/legal/privacidad` y `#/legal/terminos`.

## Comandos

```bash
npm install
npm run dev          # API en el puerto 3001 y web en http://localhost:5173
npm run typecheck    # revisa tipos en servidor y web
npm test             # pruebas (Vitest)
npm run build        # compila la web y el servidor
npm start            # producción, después de build (define PORT y las variables en el entorno)
npm run verificar    # antes de publicar: marcadores [COMPLETAR], secretos y datos personales
npm run reset-db     # restaura el viaje de ejemplo (borra los datos guardados)
```

Con Docker: `ACCESS_CODE=… SEED_USERS="tu@correo.com:admin" docker compose up -d --build`.

## Qué personalizar

| Qué | Dónde |
| --- | --- |
| Nombre de la app, eslogan, descripción, correo de contacto y servicios conectados | `shared/plantilla.ts` (un solo archivo). El título de la pestaña y el manifiesto de la PWA se generan desde aquí. |
| Garantía en días (7) | `garantiaDias` en `shared/plantilla.ts`. Términos la menciona solo si el cobro va por Hotmart. |
| Prueba en días (7) | `pruebaDias` en `shared/plantilla.ts`. La portada y el onboarding la anuncian; la app no la cobra ni la controla, así que debe coincidir con tu oferta en Hotmart. |
| Enlace de compra (Hotmart) | `enlaceCompra` en `shared/plantilla.ts`. Vacío = la portada muestra «Demostración: no se cobra nada» y no hay botón de compra. |
| Precios sugeridos (mensual y anual, en CLP) | `precios` en `shared/plantilla.ts`. La portada los muestra; el anual equivale a 10 mensualidades («dos meses gratis»). |
| Captura del héroe de la portada | `web/public/landing/itinerario-hero.webp` (780 × 980, dos veces el ancho de 390 px). Textos de la portada en `web/src/lib/ventas.ts`. |
| Textos legales (privacidad y términos) | `web/src/components/LegalPage.tsx` |
| Pantalla de acceso (portada) | `web/src/components/LockScreen.tsx` |
| Colores, tipografías y estilos | `web/src/styles/tokens.css` |
| Destinos disponibles | `CITIES` en `shared/types.ts` y `CITY_META` en `shared/constants.ts`. Ver [Añadir o quitar destinos](#añadir-o-quitar-destinos). |
| Acceso con código y cuentas | variables `ACCESS_CODE` y `SEED_USERS` |
| Lugares recomendados, fotos y sugerencias | `shared/catalog.json`, `shared/photos.json` y `PLACE_SUGGESTIONS` en `web/src/lib/osm.ts` (vacíos) |

### Añadir o quitar destinos

Los destinos viven en dos sitios: `CITIES` (`shared/types.ts`), la lista que valida el servidor, y `CITY_META` (`shared/constants.ts`), con nombre, código corto, coordenadas y color. `region` es `'ne'` (azul) o `'south'` (celeste).

Para añadir Lisboa, por ejemplo:

```ts
// shared/types.ts
export const CITIES = ['ny', 'orlando', 'miami', 'tampa', 'keywest', 'washington', 'boston', 'philadelphia', 'lisboa'] as const;

// shared/constants.ts, dentro de CITY_META
lisboa: { name: 'Lisboa', short: 'LIS', lat: 38.7223, lng: -9.1393, region: 'south' },
```

Para quitar un destino, primero cambia la ciudad de sus días en la app: el servidor ya no acepta ese código y la app no sabría mostrar su nombre. Después borra su línea en `CITIES` y en `CITY_META`.

## Datos de ejemplo que debes cambiar

- **Viaje de ejemplo:** `server/src/seed.ts`. Es un viaje genérico de 5 días a Miami que empieza dentro de una semana, sin reservas reales. Cámbialo por tu destino, tus días y tus planes. Solo se carga si la base está vacía.
- **Correo de contacto:** `correo@correo.com` es un ejemplo. Cámbialo en `shared/plantilla.ts` por uno que vayas a usar.
- **Importes:** la app maneja solo dólares (USD). No hay otra moneda que configurar.
- **Responsable y datos legales:** completa los `[COMPLETAR: …]` de `web/src/components/LegalPage.tsx` (identificador fiscal, domicilio y ley aplicable).

## Conectar tus servicios

Ningún servicio está conectado por defecto. Para base de datos en la nube, correo, cobros o IA, sigue [docs/CONECTAR.md](docs/CONECTAR.md).

**Cobro, garantía y Meta Ads.** Si vendes la app por Hotmart, el cobro y el reembolso los gestiona Hotmart, y la garantía de 7 días (`garantiaDias`) se tramita allí. La prueba de 7 días (`pruebaDias`) también debe estar en tu oferta de Hotmart. Esta plantilla no cobra. La app no carga el píxel de Meta ni otros scripts: los eventos ViewContent e InitiateCheckout se conectan desde tu página de venta, usando el `id` y el atributo `data-evento="inicio-compra"` de su CTA. Detalles en [docs/CONECTAR.md](docs/CONECTAR.md#4--cobros).

Precios sugeridos: confirma tu oferta en Hotmart antes de vender.

1. Copia `.env.example` a `.env` y completa solo lo que conectes. `.env` no se sube a git.
2. Define `ACCESS_CODE` y `SEED_USERS` antes de publicar; sin ellas nadie puede entrar.
3. Revisa y adapta los textos legales y ejecuta `npm run verificar`.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto del servidor en producción. Por defecto `3001`. |
| `API_PORT` | Puerto de la API en desarrollo. |
| `DB_PATH` | Archivo SQLite. Por defecto `data/trip.db`. |
| `DATABASE_URL` | Opcional: Postgres. Si lo defines, reemplaza a SQLite. |
| `ACCESS_CODE` | Código de acceso e invitación. Vacío = sin acceso protegido. |
| `SEED_USERS` | Cuentas iniciales, `correo:admin,correo2:member`. Solo se usan al crear la base. |

## Cómo funciona por dentro

- **Servidor:** Express 5. Guarda en SQLite (`node:sqlite`) o Postgres. Valida con Zod, aplica cambios en lote y avisa a los demás dispositivos con eventos en tiempo real.
- **Web:** React 19 y Vite. Estado con Zustand. Sin red, la app muestra la última copia guardada del viaje y envía los cambios pendientes al volver la conexión.
- **Título y PWA:** `web/vite.config.ts` escribe el nombre en `index.html` y genera el manifiesto desde `shared/plantilla.ts`.
- **Cuentas:** correo y contraseña con scrypt y sesión en cookie HttpOnly.

## Límites

- Un viaje por instalación. Todas las cuentas ven y editan el mismo viaje.
- El presupuesto maneja solo USD.
- Horarios, precios, clima y rutas son informativos: confírmalos en las fuentes oficiales.
- La primera visita necesita conexión. Si nunca abriste la app con red, el navegador no la carga sin conexión.
- Sin cobros, sin correo y sin IA.
- La suite de pruebas usa SQLite. Para probar Postgres, define `TEST_DATABASE_URL`.
