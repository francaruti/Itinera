// Capturas del pack: tres JPG de 390 × 844 desde la versión de producción, con reducción de movimiento.
//   node scripts/capturas-pack.mjs --url http://localhost:3714 --slug viajes --salida <carpeta>
// Crea <salida>/<slug>-pack/ con <slug>-1-venta.jpg, <slug>-2-onboarding.jpg y <slug>-3-app.jpg.
// - Las cifras de ejemplo de la app se quedan.
// - Los avisos de demostración llevan data-captura="oculto": se ocultan solo aquí; la app real los sigue mostrando.
// - Si queda visible alguna palabra «demo», «ejemplo» o «demostración», la captura falla.
// Sin dependencias: habla con Google Chrome por DevTools. CHROME_BIN indica el ejecutable (por defecto, el de macOS).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const opciones = Object.fromEntries(
  process.argv.slice(2).reduce((pares, arg, i, todos) => (arg.startsWith('--') ? [...pares, [arg.slice(2), todos[i + 1]]] : pares), []),
);
const url = opciones.url;
const slug = opciones.slug;
const salida = opciones.salida;
if (!url || !slug || !salida) {
  console.error('Uso: node scripts/capturas-pack.mjs --url <http://localhost:3714> --slug <slug> --salida <carpeta>');
  process.exit(2);
}

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ANCHO = 390;
const ALTO = 844;
const PROHIBIDAS = /\b(demos?|demostraci\w*|ejemplos?)\b/i;

/** Capturas: ruta de la app, selector que indica que ya cargó y nombre del archivo. */
const CAPTURAS = [
  { archivo: `${slug}-1-venta.jpg`, ruta: '#/', listo: '.venta-titulo' },
  { archivo: `${slug}-2-onboarding.jpg`, ruta: '#/empezar', listo: '#venta-paso-titulo' },
  { archivo: `${slug}-3-app.jpg`, ruta: '#/itinerario', listo: '#main .day-view, #main section, #main h1, #main h2' },
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cliente DevTools mínimo: envía comandos y recibe eventos por WebSocket (Node 24 trae WebSocket y fetch). */
function cliente(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pendientes = new Map();
  let siguiente = 0;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendientes.has(msg.id)) {
      const { resolver, rechazar } = pendientes.get(msg.id);
      pendientes.delete(msg.id);
      if (msg.error) rechazar(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolver(msg.result);
    }
  });
  return {
    abrir: () => new Promise((r, j) => {
      ws.addEventListener('open', r, { once: true });
      ws.addEventListener('error', () => j(new Error('no se pudo abrir el WebSocket de Chrome')), { once: true });
    }),
    enviar: (metodo, params = {}) =>
      new Promise((resolver, rechazar) => {
        const id = ++siguiente;
        pendientes.set(id, { resolver, rechazar });
        ws.send(JSON.stringify({ id, method: metodo, params }));
      }),
    cerrar: () => ws.close(),
  };
}

async function evaluar(pagina, expresion) {
  const { result, exceptionDetails } = await pagina.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'error al evaluar en la página');
  return result.value;
}

async function esperarA(pagina, expresion, limiteMs, etiqueta) {
  const hasta = Date.now() + limiteMs;
  while (Date.now() < hasta) {
    if (await evaluar(pagina, expresion)) return;
    await esperar(150);
  }
  throw new Error(`tiempo agotado esperando: ${etiqueta}`);
}

const perfil = mkdtempSync(join(tmpdir(), 'capturas-pack-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${perfil}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  'about:blank',
], { stdio: 'ignore' });

const destino = resolve(salida, `${slug}-pack`);
mkdirSync(destino, { recursive: true });

try {
  // Puerto de DevTools: Chrome lo escribe en DevToolsActivePort dentro del perfil.
  const archivoPuerto = join(perfil, 'DevToolsActivePort');
  const hastaPuerto = Date.now() + 20000;
  while (!existsSync(archivoPuerto)) {
    if (Date.now() > hastaPuerto) throw new Error(`Chrome no arrancó (${CHROME})`);
    await esperar(100);
  }
  const puerto = readFileSync(archivoPuerto, 'utf8').split('\n')[0].trim();
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${puerto}/json/version`)).json();
  const navegador = cliente(webSocketDebuggerUrl);
  await navegador.abrir();

  for (const captura of CAPTURAS) {
    const { browserContextId } = await navegador.enviar('Target.createBrowserContext', {});
    const { targetId } = await navegador.enviar('Target.createTarget', { url: 'about:blank', browserContextId });
    const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
    const pagina = cliente(lista.find((t) => t.id === targetId).webSocketDebuggerUrl);
    await pagina.abrir();
    await pagina.enviar('Page.enable');
    await pagina.enviar('Runtime.enable');
    await pagina.enviar('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: true });
    await pagina.enviar('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-color-scheme', value: 'light' },
      ],
    });

    await pagina.enviar('Page.navigate', { url: `${url}/${captura.ruta}` });
    await esperarA(pagina, `document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(captura.listo)})`, 30000, captura.archivo);
    await esperarA(pagina, `document.fonts.status === 'loaded'`, 10000, 'fuentes');
    await esperar(800);

    // Solo aquí se ocultan los avisos de demostración; el resto de la app no cambia.
    await evaluar(pagina, `(() => {
      const estilo = document.createElement('style');
      estilo.textContent = '[data-captura="oculto"] { display: none !important; }';
      document.head.appendChild(estilo);
      return true;
    })()`);
    await esperar(150);

    const textoVisible = await evaluar(pagina, `document.body.innerText`);
    const hallazgos = textoVisible.split('\n').filter((linea) => PROHIBIDAS.test(linea));
    if (hallazgos.length > 0) throw new Error(`${captura.archivo}: texto prohibido visible: ${hallazgos.join(' | ')}`);

    const { data } = await pagina.enviar('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 95,
      clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: 1 },
      captureBeyondViewport: false,
      fromSurface: true,
    });
    writeFileSync(join(destino, captura.archivo), Buffer.from(data, 'base64'));
    console.log(`guardada ${join(destino, captura.archivo)} (${ANCHO}×${ALTO})`);

    pagina.cerrar();
    await navegador.enviar('Target.closeTarget', { targetId });
    await navegador.enviar('Target.disposeBrowserContext', { browserContextId });
  }
  navegador.cerrar();
} finally {
  chrome.kill('SIGTERM');
  await esperar(500);
  rmSync(perfil, { recursive: true, force: true });
}
