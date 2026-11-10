// Revisión antes de publicar (npm run verificar). Sale con código 1 si encuentra:
//   1. Secretos con formato conocido (claves privadas, tokens de GitHub, Supabase, Resend, AWS o JWT).
//   2. Correos o teléfonos que parecen personales (solo se permiten dominios de ejemplo).
//   3. Archivos .env con valores o bases de datos (.db) que se subirían a git.
//   4. Valores escritos en .env.example (deben ir vacíos).
//   5. Falta el bloque `conexiones` de shared/plantilla.ts con su forma fija.
// Además lista los marcadores [COMPLETAR: …] y [VERIFICAR: …] pendientes. Con --estricto, también falla si quedan.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const estricto = process.argv.includes('--estricto');
const yo = join(root, 'scripts', 'verificar-publicacion.mjs');

const TEXTO = /\.(ts|tsx|js|mjs|cjs|json|md|html|css|sql|yml|yaml|webmanifest|example|txt|svg)$|(^|\/)(\.env\.example|\.nvmrc|Dockerfile|LICENSE|\.gitignore|\.dockerignore)$/;
const IGNORAR = /(^|\/)(node_modules|dist|\.git|\.vercel|\.claude)\/|(^|\/)package-lock\.json$/;
const MARCADOR = /\[(COMPLETAR|VERIFICAR):(?!\s*…\s*\])[^\]]*\]/;
const DOMINIOS_EJEMPLO = /@(example\.(com|org|net)|correo\.com|ejemplo\.(com|org)|dominio\.com)$/i;

const SECRETOS = [
  [/-----BEGIN ((RSA|EC|OPENSSH|DSA) )?PRIVATE KEY-----/, 'clave privada'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'clave de acceso de AWS'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'token de GitHub'],
  [/\bsbp_[A-Za-z0-9]{30,}\b/, 'token de Supabase'],
  [/\bre_[A-Za-z0-9]{20,}\b/, 'clave de Resend'],
  [/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, 'token JWT'],
];
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const TELEFONO = /(?<![\w.])\+\d{1,3}[ .-]?\(?\d{1,4}\)?[ .-]?\d{3,4}[ .-]?\d{3,4}(?!\d)/g;

const recorrer = (dir) =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    const rel = relative(root, ruta).split(sep).join('/');
    if (IGNORAR.test(rel + '/') || IGNORAR.test(rel)) return [];
    return statSync(ruta).isDirectory() ? recorrer(ruta) : [rel];
  });

/** Archivos que se publicarían: los de git (incluidos los nuevos sin ignorar) o, sin git, todo menos lo ignorado. */
function archivos() {
  try {
    const salida = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return salida.split('\0').filter(Boolean).filter((f) => !IGNORAR.test(f));
  } catch {
    return recorrer(root);
  }
}

const fallos = [];
const pendientes = [];
const lista = archivos().filter((f) => existsSync(join(root, f)) && statSync(join(root, f)).isFile());

// 3. Archivos que no deben subirse.
for (const f of lista) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)) {
    const texto = readFileSync(join(root, f), 'utf8');
    if (/^\s*[A-Z][A-Z0-9_]*\s*=\s*\S/m.test(texto)) fallos.push(`${f}: archivo de entorno con valores listo para subir (quítalo de git)`);
  }
  if (/\.(db|sqlite|sqlite3)$/i.test(f)) fallos.push(`${f}: base de datos con datos reales listo para subir`);
}

// 4. .env.example con valores.
const ejemplo = join(root, '.env.example');
if (existsSync(ejemplo)) {
  readFileSync(ejemplo, 'utf8')
    .split(/\r?\n/)
    .forEach((linea, i) => {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linea);
      if (m && m[2].trim() !== '') fallos.push(`.env.example:${i + 1}: ${m[1]} tiene un valor; debe ir vacía`);
    });
}

// 5. Bloque conexiones con su forma fija.
const plantilla = join(root, 'shared', 'plantilla.ts');
const bloque = existsSync(plantilla)
  ? readFileSync(plantilla, 'utf8').match(/conexiones:\s*\{\s*supabase:\s*(true|false),\s*hotmart:\s*(true|false),\s*resend:\s*(true|false)\s*\}/)
  : null;
if (!bloque) {
  fallos.push('falta el bloque `conexiones: { supabase, hotmart, resend }` con true o false en shared/plantilla.ts');
} else {
  console.log(`Conexiones en shared/plantilla.ts: supabase=${bloque[1]}, hotmart=${bloque[2]}, resend=${bloque[3]}`);
}

// 1 y 2. Texto: marcadores, secretos y datos personales.
for (const f of lista.filter((x) => TEXTO.test(x) && x !== relative(root, yo).split(sep).join('/'))) {
  readFileSync(join(root, f), 'utf8')
    .split(/\r?\n/)
    .forEach((linea, i) => {
      const donde = `${f}:${i + 1}`;
      if (MARCADOR.test(linea)) pendientes.push(`${donde}: ${linea.trim().slice(0, 120)}`);
      for (const [re, nombre] of SECRETOS) if (re.test(linea)) fallos.push(`${donde}: posible ${nombre}`);
      for (const [correo] of linea.matchAll(CORREO)) {
        if (!DOMINIOS_EJEMPLO.test(correo)) fallos.push(`${donde}: correo que parece personal (${correo.replace(/^(.{2}).*(@.*)$/, '$1…$2')})`);
      }
      for (const tel of linea.matchAll(TELEFONO)) fallos.push(`${donde}: posible teléfono (${tel[0].replace(/\d(?=\d{2})/g, '•')})`);
    });
}

console.log(`Marcadores pendientes: ${pendientes.length}`);
for (const p of pendientes) console.log(`  - ${p}`);

if (fallos.length > 0) {
  console.error(`Secretos o datos personales: ${fallos.length} hallazgo(s)`);
  for (const f of fallos) console.error(`  - ${f}`);
}

const bloqueantes = [...fallos];
if (estricto && pendientes.length > 0) bloqueantes.push(`quedan ${pendientes.length} marcador(es) pendiente(s) (modo --estricto)`);

if (bloqueantes.length > 0) {
  console.error('\nVerificación: FALLA.');
  process.exit(1);
}
console.log(pendientes.length > 0 ? '\nVerificación: correcta. Revisa los marcadores antes de publicar.' : '\nVerificación: correcta.');
