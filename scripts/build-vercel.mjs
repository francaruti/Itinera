// Genera .vercel/output (Build Output API v3): estáticos + una función serverless con la API de Express.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const OUT = '.vercel/output';
const FUNC = `${OUT}/functions/api.func`;

execSync('npm run build:web', { stdio: 'inherit' });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(FUNC, { recursive: true });
cpSync('dist/web', `${OUT}/static`, { recursive: true });

await build({
  entryPoints: ['server/src/vercel.ts'],
  outfile: `${FUNC}/index.js`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['pg-native'],
  footer: { js: 'module.exports = module.exports.default || module.exports;' },
  minify: false,
  legalComments: 'none',
});

writeFileSync(`${FUNC}/package.json`, JSON.stringify({ type: 'commonjs' }));
writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', maxDuration: 30, regions: ['iad1'] }, null, 2),
);

const csp =
  "default-src 'self'; base-uri 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://upload.wikimedia.org; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://upload.wikimedia.org https://*.tile.openstreetmap.org https://server.arcgisonline.com; worker-src 'self'; manifest-src 'self'";

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '/(.*)',
          headers: {
            'Content-Security-Policy': csp,
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Frame-Options': 'DENY',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Cross-Origin-Opener-Policy': 'same-origin',
          },
          continue: true,
        },
        { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '/(sw\\.js|index\\.html|manifest\\.webmanifest)', headers: { 'Cache-Control': 'no-cache' }, continue: true },
        { handle: 'filesystem' },
        { src: '/assets/(.*)', status: 404, dest: '/_not-found' },
        { src: '/api(/.*)?', dest: '/api' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

if (!existsSync(`${FUNC}/index.js`)) throw new Error('No se generó la función');
console.log('✔ .vercel/output listo');
