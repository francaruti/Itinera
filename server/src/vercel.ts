import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';

/** Punto de entrada serverless: la app se crea una vez por instancia y se reutiliza. */
let ready: Promise<(req: IncomingMessage, res: ServerResponse) => void> | undefined;

async function boot() {
  const config = { ...loadConfig(), isProd: true };
  const db = await openDb(config.databaseUrl || config.dbPath);
  return (await createApp(db, config)).app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= boot().catch((err) => {
    ready = undefined;
    throw err;
  });
  try {
    (await ready)(req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Servicio no disponible, reintenta en unos segundos.' }));
  }
}
