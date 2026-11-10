# Mi Itinerario · instrucciones para la IA de tu copia

Esta es una plantilla de planificador de viaje. La persona que la compra la personaliza con su marca, conecta sus servicios y la vende.

## Qué hace hoy y qué no

- Un viaje por instalación. Los datos viven en el servidor: SQLite en `data/trip.db` o Postgres si defines `DATABASE_URL`.
- Con `ACCESS_CODE` hay cuentas por correo y contraseña (scrypt). Sin él, la app es abierta.
- No hay cobros, correo ni IA conectados: `shared/plantilla.ts` tiene `conexiones` en `false`.
- Servicios públicos sin clave: Open-Meteo (clima), Nominatim (búsqueda de lugares), FOSSGIS (rutas), OpenStreetMap y ArcGIS (mapa y satélite).

## Reglas

1. Escribe en español latino neutro, con tuteo. No escribas «MVP», «prototipo» ni «versión de prueba» en la interfaz.
2. El nombre de la app, el correo de contacto y las conexiones salen de `shared/plantilla.ts`. No escribas el nombre a mano en otras pantallas.
3. El viaje de ejemplo está en `server/src/seed.ts`. No pongas reservas reales, códigos de confirmación, direcciones, teléfonos ni correos de personas.
4. Claves y `.env`: nunca en el código, en git ni en `.env.example`. No leas ni escribas `.env`; lo crea la persona.
5. Migraciones: no cambies una migración ya aplicada en `server/src/db.ts`. Un cambio nuevo va al final, como migración nueva.
6. No toques `server/src/auth.ts` (contraseñas, sesiones y comparaciones) sin confirmación explícita.
7. `[COMPLETAR: …]` y `[VERIFICAR: …]` son datos de la persona o datos por confirmar. No los inventes. `npm run verificar` los lista.
8. Los textos de `web/src/components/LegalPage.tsx` son borradores: no cites leyes, autoridades ni cifras nuevas.
9. No prometas en pantalla lo que la app no hace: cobros, avisos, reservas automáticas o garantías.
10. Antes de decir que algo está listo, corre `npm run typecheck`, `npm test`, `npm run build` y `npm run verificar`. Revisa las pantallas a 390 px y en escritorio.

## Dónde se personaliza

- Nombre, contacto y conexiones: `shared/plantilla.ts`.
- Viaje de ejemplo: `server/src/seed.ts`.
- Destinos: `CITIES` en `shared/types.ts` y `CITY_META` en `shared/constants.ts`.
- Colores y estilos: `web/src/styles/tokens.css`.
- Textos legales: `web/src/components/LegalPage.tsx`.
- Pantalla de acceso: `web/src/components/LockScreen.tsx`.

## Comandos

```bash
npm install
npm run dev          # API en 3001 y web en 5173
npm run typecheck
npm test
npm run build
npm start            # producción, después de build
npm run verificar    # gate antes de publicar
npm run reset-db     # restaura el viaje de ejemplo (borra los datos)
```

## No tocar sin confirmación

- `server/src/auth.ts`, `server/src/db.ts` (migraciones ya aplicadas) y `server/src/model.ts` (validación de entradas).
- Las pruebas de integridad de datos y de recuperación en `server/test/api.test.ts`. Si una prueba falla, corrige la causa; no la borres.

## Stack

- Servidor: Express 5, `node:sqlite` o Postgres (`pg`), Zod. Node 22.13 o superior (`.nvmrc`: 24).
- Web: React 19, TypeScript, Vite, Framer Motion, Zustand y Leaflet.
- Pruebas: Vitest y Supertest.

## Si algo falla

Lee el error completo, identifica la prueba que falla y corrige la causa. No apagues comprobaciones ni cambies un dato para que la verificación pase.
