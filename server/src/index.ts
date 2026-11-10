import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';

const config = loadConfig();
const db = await openDb(config.databaseUrl || config.dbPath);
const { app, hub } = await createApp(db, config, { log: true });

const server = app.listen(config.port, () => {
  console.log(`Viajes escuchando en http://localhost:${config.port}  (${config.isProd ? 'producción' : 'desarrollo'})`);
  console.log(`Base de datos: ${config.databaseUrl ? 'Postgres' : config.dbPath}`);
  console.log(config.accessCode ? 'Acceso protegido con código.' : 'Acceso abierto (define ACCESS_CODE para protegerlo).');
});

function shutdown(signal: string) {
  console.log(`\n${signal} recibido, cerrando…`);
  hub.close();
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
