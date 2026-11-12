-- Fase 3 (viajes múltiples): la tabla del viaje admite más de un viaje (quita la restricción de id = 1).
-- Solo relaja una restricción: no cambia ni borra datos. Se aplica después de fase 2 y antes de fusionar la fase 3.
ALTER TABLE viaje.trip DROP CONSTRAINT IF EXISTS trip_id_check;
