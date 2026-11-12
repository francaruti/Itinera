-- Fase 2 (viajes múltiples): días y actividades se identifican también por viaje.
-- Se aplica DESPUÉS de server/sql/postgres.sql y solo una vez, sobre una base que ya tenga trip_id (fase 1).
-- Antes de aplicarla en Supabase: respaldo completo y revisión de los nombres de las restricciones.

-- El orden importa: primero se suelta la clave foránea de actividades, y luego la clave de días.
ALTER TABLE viaje.activities DROP CONSTRAINT IF EXISTS activities_day_date_fkey;
ALTER TABLE viaje.days DROP CONSTRAINT IF EXISTS days_pkey;
ALTER TABLE viaje.days ADD PRIMARY KEY (trip_id, date);
ALTER TABLE viaje.activities
  ADD CONSTRAINT activities_day_fkey FOREIGN KEY (trip_id, day_date)
  REFERENCES viaje.days (trip_id, date) ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS viaje.idx_activities_day;
CREATE INDEX IF NOT EXISTS idx_activities_day ON viaje.activities (trip_id, day_date, position);
