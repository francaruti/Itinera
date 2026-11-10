import { resolve } from 'node:path';

export interface Config {
  port: number;
  dbPath: string;
  /** URL de Postgres (Supabase). Si existe, tiene prioridad sobre `dbPath`. */
  databaseUrl: string;
  /** En funciones serverless no hay conexiones largas (SSE) ni archivos estáticos propios. */
  serverless: boolean;
  /** Si está definido, la app pide este código para entrar. */
  accessCode: string;
  /** Cuentas iniciales (`correo:admin,correo2:member`), solo al crear la base. */
  seedUsers: string;
  isProd: boolean;
  webDir: string;
}

/** Una variable vacía (p. ej. «PORT=» en .env.example) cuenta como no definida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.API_PORT || env.PORT || 3001),
    dbPath: env.DB_PATH || resolve('data/trip.db'),
    databaseUrl: (env.DATABASE_URL ?? '').trim(),
    serverless: !!env.VERCEL,
    accessCode: (env.ACCESS_CODE ?? '').trim(),
    seedUsers: env.SEED_USERS ?? '',
    isProd: env.NODE_ENV === 'production',
    webDir: env.WEB_DIR || resolve('dist/web'),
  };
}
