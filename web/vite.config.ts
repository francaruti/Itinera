import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { plantilla } from '../shared/plantilla.ts';

/** Manifiesto de la PWA. Nombre y descripción salen de shared/plantilla.ts: no se escriben a mano. */
const manifiesto = () =>
  `${JSON.stringify(
    {
      name: `${plantilla.nombre} · ${plantilla.eslogan}`,
      short_name: plantilla.nombre,
      description: plantilla.descripcion,
      lang: 'es',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      categories: ['travel', 'lifestyle'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
      shortcuts: [
        { name: 'Presupuesto', url: '/#/presupuesto', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        { name: 'Reservas', url: '/#/reservas', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        { name: 'Mapa', url: '/#/mapa', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      ],
    },
    null,
    2,
  )}\n`;

/** Escribe el nombre de la app en index.html y genera el manifiesto de la PWA desde shared/plantilla.ts (dev y build). */
const identidad = (): Plugin => ({
  name: 'identidad-plantilla',
  enforce: 'pre',
  transformIndexHtml(html) {
    return html
      .replaceAll('%NOMBRE%', plantilla.nombre)
      .replaceAll('%ESLOGAN%', plantilla.eslogan)
      .replaceAll('%DESCRIPCION%', plantilla.descripcion);
  },
  configureServer(server) {
    server.middlewares.use('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.end(manifiesto());
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifiesto() });
  },
});

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react(), identidad()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  build: {
    outDir: resolve(import.meta.dirname, '../dist/web'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion';
          if (id.includes('leaflet')) return 'leaflet';
          if (/node_modules\/(react|react-dom|scheduler|zustand)\//.test(id)) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
