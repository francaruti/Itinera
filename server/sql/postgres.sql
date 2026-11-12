-- Esquema de Postgres (Supabase). Idempotente. Todo vive en el esquema "viaje",
-- aislado de cualquier otro dato de la base. Solo el rol de la app tiene acceso.
CREATE SCHEMA IF NOT EXISTS viaje;

CREATE TABLE IF NOT EXISTS viaje.trip (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  budget_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  fx_rate DOUBLE PRECISION NOT NULL DEFAULT 4000,
  travelers TEXT NOT NULL DEFAULT '[]',
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS viaje.days (
  date TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  travel INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS viaje.activities (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL REFERENCES viaje.days(date) ON DELETE CASCADE ON UPDATE CASCADE,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  time TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  place TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cost DOUBLE PRECISION,
  booking TEXT NOT NULL DEFAULT 'none',
  url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_day ON viaje.activities(day_date, position);
CREATE TABLE IF NOT EXISTS viaje.checklist (
  id TEXT PRIMARY KEY,
  list TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS viaje.reservations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  confirmation TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL DEFAULT '',
  ends_at TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'ny',
  address TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'todo',
  paid INTEGER NOT NULL DEFAULT 0,
  url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);
ALTER TABLE viaje.reservations ADD COLUMN IF NOT EXISTS flight_no TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS viaje.expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_by TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS viaje.attachments (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
ALTER TABLE viaje.attachments ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_attachments_res ON viaje.attachments(reservation_id);
CREATE TABLE IF NOT EXISTS viaje.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  last_login BIGINT
);
CREATE TABLE IF NOT EXISTS viaje.meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Defensa en profundidad: RLS activo y sin acceso para los roles públicos de la API.
ALTER TABLE viaje.trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.days ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE viaje.meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA viaje FROM PUBLIC, anon, authenticated;
-- Viajes múltiples (fase 1): cada registro indica su viaje. Por ahora todo es del viaje 1.
ALTER TABLE viaje.days ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE viaje.activities ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE viaje.checklist ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE viaje.reservations ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE viaje.expenses ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE viaje.attachments ADD COLUMN IF NOT EXISTS trip_id INTEGER NOT NULL DEFAULT 1;

REVOKE ALL ON ALL TABLES IN SCHEMA viaje FROM PUBLIC, anon, authenticated;

-- Rol de la app (se crea aparte con su contraseña): acceso solo a este esquema, con una política por tabla.
-- Para cada tabla nueva (p. ej. attachments) hace falta: GRANT SELECT, INSERT, UPDATE, DELETE ... TO viaje_app
-- y CREATE POLICY viaje_app_all ON viaje.<tabla> FOR ALL TO viaje_app USING (true) WITH CHECK (true);
