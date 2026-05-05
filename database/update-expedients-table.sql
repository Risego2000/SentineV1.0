-- ============================================================================
-- UPDATE EXPEDIENTS TABLE - Sentinel AI
-- Agrega columnas faltantes a la tabla expedients existente
-- SEGURO: No borra datos, solo agrega lo que falta
-- ============================================================================

-- Ver estructura actual (para debugging)
-- \d expedients;

-- ============================================================================
-- AGREGAR COLUMNAS FALTANTES
-- ============================================================================

-- Campos de identificación
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS operator_id UUID;

-- Información del caso
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS vehicle_description TEXT;

-- Datos del lugar
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS via VARCHAR(255);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS numero_punto_kilometrico DECIMAL(10,2);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS latitud DECIMAL(10,8);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8);

-- Normativa y regulación
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS gravedad VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS norma_conducta_nombre TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS norma_conducta_abreviatura VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS articulo_conducta VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS articulo_conducta_texto TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS norma_sancionadora_nombre TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS norma_sancionadora_abreviatura VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS articulo_sancionador VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS articulo_sancionador_texto TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS codigo_senal VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS descripcion_senal TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS definicion_infraccion TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conducta_denunciada TEXT;

-- Sanción
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS sancion_euros DECIMAL(10,2);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS puntos_detraccion INTEGER;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS riesgo_nivel VARCHAR(50);

-- Datos del vehículo
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS color VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS numero_chasis VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS estado_itv VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS seguro_obligatorio VARCHAR(50);

-- Datos del titular
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_nombre VARCHAR(255);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_dni VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_domicilio TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_localidad VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_provincia VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_telefono VARCHAR(20);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS titular_email VARCHAR(255);

-- Datos del conductor
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_nombre VARCHAR(255);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_dni VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_permiso VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_clase VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_domicilio TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_localidad VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_provincia VARCHAR(100);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_telefono VARCHAR(20);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS conductor_email VARCHAR(255);

-- Descripción de hechos
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS descripcion_detallada_hechos TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS circunstancias_agravantes TEXT;

-- Evidencia
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS evidence_id UUID;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS photos_count INTEGER DEFAULT 0;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS video_clip_hash VARCHAR(255);

-- Firma y metadata
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS signature_is_signed BOOLEAN DEFAULT FALSE;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS signature_signed_by VARCHAR(255);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(255);

-- Historial y auditoría
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS state_history JSONB DEFAULT '[]'::jsonb;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;

-- Cumplimiento normativo
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS dpia_certified BOOLEAN DEFAULT FALSE;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 365;

-- Cadena de custodia
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS custody_last_checked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS custody_last_status VARCHAR(50);

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS custody_last_summary TEXT;

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS custody_verification_rows JSONB;

-- Metadatos
ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE expedients
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- CREAR ÍNDICES SI NO EXISTEN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expedients_license_plate
  ON expedients(license_plate);

CREATE INDEX IF NOT EXISTS idx_expedients_infraction_id
  ON expedients(infraction_id);

CREATE INDEX IF NOT EXISTS idx_expedients_created_by
  ON expedients(created_by);

CREATE INDEX IF NOT EXISTS idx_expedients_operator_id
  ON expedients(operator_id);

CREATE INDEX IF NOT EXISTS idx_expedients_state_created_at
  ON expedients(state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expedients_pending
  ON expedients(state, created_at DESC)
  WHERE state != 'EXPORTED' AND state != 'ARCHIVED';

-- ============================================================================
-- CREAR TRIGGER PARA UPDATE AUTOMÁTICO
-- ============================================================================

CREATE OR REPLACE FUNCTION update_expedients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expedients_updated_at ON expedients;

CREATE TRIGGER update_expedients_updated_at
  BEFORE UPDATE ON expedients
  FOR EACH ROW
  EXECUTE FUNCTION update_expedients_updated_at();

-- ============================================================================
-- VERIFICAR QUE FUNCIONÓ
-- ============================================================================

-- Ejecuta este comando para ver la estructura final:
-- \d expedients;

-- Cuénta las columnas:
-- SELECT COUNT(*) as total_columnas FROM information_schema.columns
-- WHERE table_name = 'expedients';

-- Lista todas las columnas:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'expedients' ORDER BY ordinal_position;
