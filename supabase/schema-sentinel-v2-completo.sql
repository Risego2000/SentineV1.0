-- ============================================================================
-- SENTINEL AI v2 - SCHEMA COMPLETO
-- Sistema integral de detección, infracciones y expedientes
-- ============================================================================

-- Habilitar extensión para UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLA 1: EXPEDIENTS (Expedientes legales)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expedients (
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
-- TABLA 2: INFRACTIONS (Infracciones detectadas por IA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.infractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID REFERENCES public.expedients(id) ON DELETE CASCADE,

  -- Información básica
  plate VARCHAR(50) NOT NULL,
  detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Tipo y severidad
  violation_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50),
  priority VARCHAR(50),

  -- Localización
  location TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Evidencia
  image_base64 TEXT,
  image_snapshot TEXT,
  video_clip_path TEXT,
  video_clip_base64 TEXT,

  -- Metadata
  confidence_score DECIMAL(3,2),
  source VARCHAR(50),
  track_id VARCHAR(100),
  track_global_id VARCHAR(255),

  -- Auditoría
  validation_status VARCHAR(50) DEFAULT 'pending',
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,

  -- Información enriquecida por Gemini
  make_model VARCHAR(255),
  color VARCHAR(100),
  description TEXT,
  legal_base TEXT,
  reasoning TEXT[],
  fine_amount DECIMAL(10,2),
  points_deducted INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA 3: EVIDENCE (Evidencia digital asociada)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES public.expedients(id) ON DELETE CASCADE,
  infraction_id UUID REFERENCES public.infractions(id) ON DELETE CASCADE,

  -- Tipo de evidencia
  kind VARCHAR(50) NOT NULL, -- 'ORIGINAL', 'PROCESADA', 'REPORTE', 'SNAPSHOT', 'ZOOM'

  -- Contenido
  file_name VARCHAR(255),
  file_path TEXT,
  file_hash VARCHAR(255),
  file_size_bytes BIGINT,
  content_type VARCHAR(100),

  -- URL o base64
  image_url TEXT,
  image_base64 TEXT,

  -- Metadata
  captured_at TIMESTAMP WITH TIME ZONE,
  captured_by VARCHAR(255),
  capture_type VARCHAR(50), -- 'INITIAL', 'MID', 'FINAL', 'ZOOM_INITIAL', 'ZOOM_MID', 'ZOOM_FINAL'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA 4: EXPEDIENT_IMAGES (Imágenes asociadas a expedientes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expedient_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES public.expedients(id) ON DELETE CASCADE,

  -- Tipo de imagen
  kind VARCHAR(50) NOT NULL, -- 'ORIGINAL', 'GENERAL', 'DETALLE', 'ZOOM', 'EVIDENCIA'

  -- URL o base64
  image_url TEXT,
  image_base64 TEXT,

  -- Metadata
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA 5: AUDIT_LOGS (Registro de auditoría detallado)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID REFERENCES public.expedients(id) ON DELETE CASCADE,
  infraction_id UUID REFERENCES public.infractions(id) ON DELETE CASCADE,

  -- Acción registrada
  action VARCHAR(100) NOT NULL,
  actor_id UUID NOT NULL,
  actor_name VARCHAR(255),

  -- Detalles
  details JSONB,
  before_state JSONB,
  after_state JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ÍNDICES - Optimización de consultas
-- ============================================================================

-- Expedients indexes
CREATE INDEX IF NOT EXISTS idx_expedients_state ON public.expedients(state);
CREATE INDEX IF NOT EXISTS idx_expedients_created_at ON public.expedients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedients_license_plate ON public.expedients(license_plate);
CREATE INDEX IF NOT EXISTS idx_expedients_infraction_id ON public.expedients(infraction_id);
CREATE INDEX IF NOT EXISTS idx_expedients_created_by ON public.expedients(created_by);
CREATE INDEX IF NOT EXISTS idx_expedients_operator_id ON public.expedients(operator_id);
CREATE INDEX IF NOT EXISTS idx_expedients_state_created_at ON public.expedients(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedients_pending ON public.expedients(state, created_at DESC)
  WHERE state != 'EXPORTED' AND state != 'ARCHIVED';

-- Infractions indexes
CREATE INDEX IF NOT EXISTS idx_infractions_plate ON public.infractions(plate);
CREATE INDEX IF NOT EXISTS idx_infractions_severity ON public.infractions(severity);
CREATE INDEX IF NOT EXISTS idx_infractions_priority ON public.infractions(priority);
CREATE INDEX IF NOT EXISTS idx_infractions_created_at ON public.infractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infractions_expedient_id ON public.infractions(expedient_id);
CREATE INDEX IF NOT EXISTS idx_infractions_validation_status ON public.infractions(validation_status);
CREATE INDEX IF NOT EXISTS idx_infractions_track_id ON public.infractions(track_id);

-- Evidence indexes
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id ON public.evidence(expedient_id);
CREATE INDEX IF NOT EXISTS idx_evidence_kind ON public.evidence(kind);
CREATE INDEX IF NOT EXISTS idx_evidence_infraction_id ON public.evidence(infraction_id);

-- Expedient images indexes
CREATE INDEX IF NOT EXISTS idx_expedient_images_expedient_id ON public.expedient_images(expedient_id);
CREATE INDEX IF NOT EXISTS idx_expedient_images_kind ON public.expedient_images(kind);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_expedient_id ON public.audit_logs(expedient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_infraction_id ON public.audit_logs(infraction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedient_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven sus propios expedientes
CREATE POLICY expedients_user_isolation ON public.expedients
  FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = operator_id);

CREATE POLICY expedients_insert_self ON public.expedients
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY expedients_update_self ON public.expedients
  FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = operator_id);

-- Infractions RLS
CREATE POLICY infractions_user_isolation ON public.infractions
  FOR SELECT
  USING (
    expedient_id IN (
      SELECT id FROM public.expedients
      WHERE auth.uid() = created_by OR auth.uid() = operator_id
    )
  );

-- Evidence RLS
CREATE POLICY evidence_user_isolation ON public.evidence
  FOR SELECT
  USING (
    expedient_id IN (
      SELECT id FROM public.expedients
      WHERE auth.uid() = created_by OR auth.uid() = operator_id
    )
  );

-- Expedient images RLS
CREATE POLICY expedient_images_user_isolation ON public.expedient_images
  FOR SELECT
  USING (
    expedient_id IN (
      SELECT id FROM public.expedients
      WHERE auth.uid() = created_by OR auth.uid() = operator_id
    )
  );

-- Audit logs RLS
CREATE POLICY audit_logs_user_isolation ON public.audit_logs
  FOR SELECT
  USING (
    (expedient_id IN (
      SELECT id FROM public.expedients
      WHERE auth.uid() = created_by OR auth.uid() = operator_id
    ))
    OR
    (infraction_id IN (
      SELECT id FROM public.infractions
      WHERE expedient_id IN (
        SELECT id FROM public.expedients
        WHERE auth.uid() = created_by OR auth.uid() = operator_id
      )
    ))
  );

-- ============================================================================
-- TRIGGERS - Actualizar updated_at automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para expedients
CREATE TRIGGER update_expedients_updated_at
  BEFORE UPDATE ON public.expedients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para infractions
CREATE TRIGGER update_infractions_updated_at
  BEFORE UPDATE ON public.infractions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FUNCIONES ÚTILES
-- ============================================================================

-- Función para contar expedientes por estado
CREATE OR REPLACE FUNCTION public.count_expedients_by_state(user_id UUID)
RETURNS TABLE(state VARCHAR(50), count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.state, COUNT(*)::BIGINT
  FROM public.expedients e
  WHERE e.created_by = user_id OR e.operator_id = user_id
  GROUP BY e.state;
END;
$$ LANGUAGE plpgsql;

-- Función para contar infracciones por severidad
CREATE OR REPLACE FUNCTION public.count_infractions_by_severity()
RETURNS TABLE(severity VARCHAR(50), count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT i.severity, COUNT(*)::BIGINT
  FROM public.infractions i
  GROUP BY i.severity;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener expedientes pendientes
CREATE OR REPLACE FUNCTION public.get_pending_expedients(user_id UUID)
RETURNS TABLE(
  id UUID,
  license_plate VARCHAR(50),
  violation_type VARCHAR(100),
  state VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.license_plate, e.violation_type, e.state, e.created_at
  FROM public.expedients e
  WHERE (e.created_by = user_id OR e.operator_id = user_id)
    AND e.state NOT IN ('EXPORTED', 'ARCHIVED')
  ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE public.expedients IS 'Expedientes legales de infracciones de tráfico';
COMMENT ON TABLE public.infractions IS 'Infracciones detectadas por IA en tiempo real';
COMMENT ON TABLE public.evidence IS 'Evidencia digital (fotos, videos) asociada a expedientes';
COMMENT ON TABLE public.expedient_images IS 'Imágenes almacenadas para expedientes';
COMMENT ON TABLE public.audit_logs IS 'Registro detallado de cambios en expedientes e infracciones';

COMMENT ON COLUMN public.expedients.state IS 'Estados: DETECTED, UNDER_REVIEW, VALIDATED, SIGNED, EXPORTED, REJECTED, ARCHIVED';
COMMENT ON COLUMN public.expedients.license_plate IS 'Placa del vehículo infractor (ej: ABC-1234)';
COMMENT ON COLUMN public.expedients.sancion_euros IS 'Monto de la multa en euros';
COMMENT ON COLUMN public.expedients.created_by IS 'UUID del usuario que creó el expediente';

COMMENT ON COLUMN public.infractions.validation_status IS 'Estados: pending (esperando auditoría), validated (confirmado), rejected (descartado)';
COMMENT ON COLUMN public.infractions.track_id IS 'ID local del track del vehículo en el frame processor';
COMMENT ON COLUMN public.infractions.track_global_id IS 'ID global único del track (formato: live-viewer-1-session-00001)';
