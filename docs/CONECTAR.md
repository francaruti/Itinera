# Conectar tus servicios

**Estado actual:** ningún servicio de pago, correo ni IA está conectado. La app funciona completa con los datos guardados en tu servidor (SQLite, o Postgres si lo defines). Esta guía describe qué conectarías y en qué orden.

## Antes de empezar

- Copia `.env.example` a `.env` y completa solo las variables de lo que conectes. `.env` está en `.gitignore`: nunca lo subas a git.
- Las claves secretas van solo en el servidor. Nunca en el código de la web ni en `.env.example`.
- Antes de cada paso que cree cuentas, cobre o envíe correos, confirma con la persona que lo va a usar.

## Bloque `conexiones`

`shared/plantilla.ts` tiene la forma fija de la familia de plantillas: `supabase`, `hotmart` y `resend`. En esta app:

- `supabase`: base de datos y cuentas en la nube. Aquí equivale a Postgres (paso 1). Las cuentas ya son propias (paso 2).
- `hotmart`: cobros. No hay cobros.
- `resend`: correo. No hay envío de correos.

Pon un valor en `true` solo cuando la conexión esté implementada, probada y exportada con ese mismo valor.

## 1 · Base de datos en la nube (Postgres)

Qué hace: si defines `DATABASE_URL`, la app usa Postgres en lugar de SQLite. El esquema está en `server/sql/postgres.sql` y crea el esquema `viaje`.

1. Crea una base Postgres en tu proveedor (por ejemplo Supabase, con el pooler de conexiones).
2. Aplica `server/sql/postgres.sql` en esa base.
3. Define `DATABASE_URL` en tu entorno o en `.env`.
4. Arranca la app y comprueba que `GET /api/health` responde 200 y que un cambio se guarda.

Ojo con los parámetros de SSL de tu proveedor: [VERIFICAR: parámetros SSL que pide tu proveedor de Postgres en su documentación oficial].

Pon `supabase` en `true` en `shared/plantilla.ts` solo cuando esto esté probado.

## 2 · Cuentas: ya incluidas

Con `ACCESS_CODE` la app pide correo y contraseña. Las cuentas iniciales se crean con `SEED_USERS` (`correo:admin,correo2:member`). La persona administradora agrega más correos en **Ajustes → Datos compartidos**.

Si prefieres un proveedor de cuentas externo, habría que reemplazar el almacenamiento de usuarios en `server/src/auth.ts`. Hazlo solo con revisión, porque ahí están las contraseñas y las sesiones.

## 3 · Correo (avisos o invitaciones)

No hay envío de correos. Para añadirlo:

1. Elige un proveedor de correo transaccional y crea una clave (guárdala solo en el servidor).
2. Escribe el envío en una función de `server/src/` que se llame desde una ruta del servidor.
3. Define la variable en `.env` y pon `resend` en `true` en `shared/plantilla.ts` cuando esté probado.

Mientras tanto, las cuentas se dan de alta con `SEED_USERS` o desde Ajustes, y no se envía ningún aviso.

## 4 · Cobros

No hay cobros conectados. Esta plantilla no cobra ni procesa pagos, y así lo dicen los textos de la app.

**Si vendes la app por Hotmart:**

- **Cobro y reembolso:** los gestiona Hotmart. La app no recibe pagos ni reembolsos.
- **Enlace de compra:** pon el enlace `https://` de tu oferta en `enlaceCompra` de `shared/plantilla.ts`. Con enlace, la portada muestra «Comprar en Hotmart». Vacío, no aparece ese botón y la portada muestra «Demostración: no se cobra nada».
- **Garantía de 7 días:** el valor está en `garantiaDias` de `shared/plantilla.ts` (7). Úsalo igual en tu oferta de Hotmart. Una solicitud dentro de ese plazo se tramita con Hotmart; la app no tiene otro proceso de reembolso.
- **Prueba de 7 días:** el valor está en `pruebaDias` de `shared/plantilla.ts` (7). La portada y el onboarding lo anuncian. Configúrala igual en tu oferta de Hotmart: la app no cobra ni controla la prueba.
- **Términos:** la sección «Garantía de 7 días» de `web/src/components/LegalPage.tsx` aplica solo si cobras por Hotmart. Si cobras, déjala; si no, bórrala.
- **Acceso de quien compra:** la app no crea cuentas al pagar. Añade a cada comprador con `SEED_USERS` (solo se usa al crear la base) o desde **Ajustes → Datos compartidos**. Si quieres automatizarlo, hazlo en el servidor, verificando las notificaciones de Hotmart y sin activar el acceso dos veces.
- Pon `hotmart` en `true` en `shared/plantilla.ts` solo cuando esa integración esté implementada, probada y exportada con ese mismo valor.

Los precios de la portada salen de `precios` en `shared/plantilla.ts` (mensual y anual, en CLP). Precios sugeridos: confirma tu oferta en Hotmart antes de vender. Si cambias una cifra, cámbiala en `precios` y en tu oferta a la vez. La app no cobra: no añadas promesas de cobro que no existan.

## 5 · IA

No hay IA conectada. Si la añades (por ejemplo para sugerir planes), hazlo solo en el servidor, con la clave en el entorno, y deja la salida a revisión de la persona antes de guardarla en el viaje.

## 6 · Medición para Meta Ads

La app no carga el píxel de Meta ni otros scripts de terceros. Su portada pública (`#/`, sin sesión) es la página de venta: ahí van los eventos, con los atributos que ya tienen sus CTA. Quien ya tiene acceso entra por `#/acceso`.

1. En la portada, «Empezar mi viaje» tiene `data-evento="inicio-compra"` y un `id` estable (`cta-empezar-arriba`, `cta-empezar-medio` y `cta-empezar-final`): la misma acción en tres lugares. El botón «Comprar en Hotmart» (`cta-comprar`) aparece solo con `enlaceCompra` y lleva el mismo atributo. «Ya tengo acceso» usa `data-evento="acceso-existente"`.
2. Pega el píxel de Meta solo en esa página, nunca en la app.
3. `ViewContent`: se envía al cargar la página de venta.
4. `InitiateCheckout`: se envía al hacer clic en los elementos con `data-evento="inicio-compra"`.

Ejemplo para tu página de venta (no es código de la app):

```html
<script>
  window.fbq && window.fbq('track', 'ViewContent');
  document.querySelectorAll('[data-evento="inicio-compra"]').forEach((el) => {
    el.addEventListener('click', () => window.fbq && window.fbq('track', 'InitiateCheckout'));
  });
</script>
```

## Antes de publicar

1. Define `ACCESS_CODE` y `SEED_USERS` con correos reales.
2. Sirve la app por HTTPS.
3. Completa los `[COMPLETAR: …]` de `web/src/components/LegalPage.tsx` y revisa los textos con asesoría de tu país.
4. Cambia `correo@correo.com` por tu correo de contacto en `shared/plantilla.ts`.
5. Confirma que la garantía de Términos y tu oferta de Hotmart dicen lo mismo (7 días).
6. Confirma que `precios` de `shared/plantilla.ts` coincide con tu oferta de Hotmart, en pesos chilenos (CLP), y que la prueba de 7 días (`pruebaDias`) está en esa oferta.
7. Ejecuta `npm run verificar` y las pruebas (`npm test`).
