import { loadConfig } from './config';
import { openDb } from './db';
import { buildSeed } from './seed';
import { createStore } from './store';

const config = loadConfig();
const db = await openDb(config.databaseUrl || config.dbPath);
await createStore(db).importSnapshot(buildSeed());
console.log('Base de datos restaurada al viaje de ejemplo.');
await db.close();
