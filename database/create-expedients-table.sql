-- ============================================================================
-- CREATE EXPEDIENTS TABLE - Sentinel AI
-- Schema de infracciones y expedientes legales
-- ============================================================================

-- Tabla principal de expedientes
CREATE TABLE IF NOT EXISTS expedients (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  infraction_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state VARCHAR(50) NOT NULL DEFAULT 'DETECTED',

  -- Información del caso
  violation_type VARCHAR(100) NOT NULL,
  location TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  vehicle_description TEXT,

  -- Datos del lugar
  via VARCHAR(255),
  numero_punto_kilometrico DECIMAL(10,2),
  municipio VARCHAR(100),
  provincia VARCHAR(100),
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),

  -- Normativa y regulación
  gravedad VARCHAR(50),
  norma_conducta_nombre TEXT,
  norma_conducta_abreviatura VARCHAR(50),
  articulo_conducta VARCHAR(100),
  articulo_conducta_texto TEXT,
  norma_sancionadora_nombre TEXT,
  norma_sancionadora_abreviatura VARCHAR(50),
  articulo_sancionador VARCHAR(100),
  articulo_sancionador_texto TEXT,
  codigo_senal VARCHAR(50),
  descripcion_senal TEXT,
  definicion_infraccion TEXT,
  conducta_denunciada TEXT,

  -- Sanción
  sancion_euros DECIMAL(10,2),
  puntos_detraccion INTEGER,
  riesgo_nivel VARCHAR(50),

  -- Datos del vehículo
  marca VARCHAR(100),
  modelo VARCHAR(100),
  color VARCHAR(50),
  numero_chasis VARCHAR(50),
  estado_itv VARCHAR(50),
  seguro_obligatorio VARCHAR(50),

  -- Datos del titular
  titular_nombre VARCHAR(255),
  titular_dni VARCHAR(50),
  titular_domicilio TEXT,
  titular_localidad VARCHAR(100),
  titular_provincia VARCHAR(100),
  titular_telefono VARCHAR(20),
  titular_email VARCHAR(255),

  -- Datos del conductor
  conductor_nombre VARCHAR(255),
  conductor_dni VARCHAR(50),
  conductor_permiso VARCHAR(50),
  conductor_clase VARCHAR(50),
  conductor_domicilio TEXT,
  conductor_localidad VARCHAR(100),
  conductor_provincia VARCHAR(100),
  conductor_telefono VARCHAR(20),
  conductor_email VARCHAR(255),

  -- Descripción de hechos
  descripcion_detallada_hechos TEXT,
  circunstancias_agravantes TEXT,

  -- Evidencia
  evidence_id UUID,
  photos_count INTEGER DEFAULT 0,
  video_clip_hash VARCHAR(255),

  -- Firma y metadata
  operator VARCHAR(255),
  supervisor VARCHAR(255),
  signature_is_signed BOOLEAN DEFAULT FALSE,
  signature_signed_by VARCHAR(255),
  signature_hash VARCHAR(255),

  -- Historial y auditoría
  state_history JSONB DEFAULT '[]'::jsonb,
  audit_log JSONB DEFAULT '[]'::jsonb,

  -- Cumplimiento normativo
  dpia_certified BOOLEAN DEFAULT FALSE,
  data_retention_days INTEGER DEFAULT 365,

  -- Cadena de custodia
  custody_last_checked_at TIMESTAMP WITH TIME ZONE,
  custody_last_status VARCHAR(50),
  custody_last_summary TEXT,
  custody_verification_rows JSONB,

  -- Usuario y autorización
  created_by UUID NOT NULL,
  operator_id UUID,

  -- Metadatos
  tags TEXT[] DEFAULT '{}',
  notes TEXT
);

-- ============================================================================
-- INDEXES - Optimización de consultas
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

CREATE INDEX IF NOT EXISTS idx_expedients_under_review
  ON expedients(created_at DESC)
  WHERE state = 'UNDER_REVIEW';

-- ============================================================================
-- TABLA INFRACTIONS - Registro de infracciones detectadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS infractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID REFERENCES expedients(id) ON DELETE CASCADE,

  -- Información básica
  plate VARCHAR(50) NOT NULL,
  detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Tipo y severidad
  violation_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50),

  -- Localización
  location TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Evidencia
  image_base64 TEXT,
  video_clip_path TEXT,

  -- Metadata
  confidence_score DECIMAL(3,2),
  source VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

CREATE INDEX IF NOT EXISTS idx_infractions_severity
  ON infractions(severity);

CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_infractions_expedient_id
  ON infractions(expedient_id);

-- ============================================================================
-- TABLA EVIDENCE - Evidencia digital asociada
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,

  -- Tipo de evidencia
  kind VARCHAR(50) NOT NULL, -- 'ORIGINAL', 'PROCESADA', 'REPORTE'

  -- Contenido
  file_name VARCHAR(255),
  file_path TEXT,
  file_hash VARCHAR(255),
  file_size_bytes BIGINT,

  -- Metadata
  captured_at TIMESTAMP WITH TIME ZONE,
  captured_by VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);

CREATE INDEX IF NOT EXISTS idx_evidence_kind
  ON evidence(kind);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven sus propios expedientes
CREATE POLICY expedients_user_isolation
  ON expedients
  FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = operator_id);

CREATE POLICY expedients_insert_self
  ON expedients
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY expedients_update_self
  ON expedients
  FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = operator_id);

-- ============================================================================
-- TRIGGERS - Actualizar updated_at automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expedients_updated_at
  BEFORE UPDATE ON expedients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_infractions_updated_at
  BEFORE UPDATE ON infractions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCIONES ÚTILES
-- ============================================================================

-- Función para contar expedientes por estado
CREATE OR REPLACE FUNCTION count_expedients_by_state(user_id UUID)
RETURNS TABLE(state VARCHAR(50), count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.state, COUNT(*)::BIGINT
  FROM expedients e
  WHERE e.created_by = user_id OR e.operator_id = user_id
  GROUP BY e.state;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE expedients IS 'Expedientes legales de infracciones de tráfico';
COMMENT ON TABLE infractions IS 'Registro de infracciones detectadas por IA';
COMMENT ON TABLE evidence IS 'Evidencia digital asociada a expedientes';

COMMENT ON COLUMN expedients.state IS 'DETECTED, UNDER_REVIEW, VALIDATED, SIGNED, EXPORTED, REJECTED, ARCHIVED';
COMMENT ON COLUMN expedients.license_plate IS 'Placa del vehículo infractor';
COMMENT ON COLUMN expedients.sancion_euros IS 'Monto de la multa en euros';
COMMENT ON COLUMN expedients.state_history IS 'Historial JSON de transiciones de estado';
COMMENT ON COLUMN expedients.audit_log IS 'Log JSON de auditoría con cambios realizados';
