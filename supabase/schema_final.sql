-- ============================================
-- Sentinel V16 - Schema FinalCompleto
-- EJECUTAR ESTE ARCHIVO COMPLETO
-- ============================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EVIDENCIA
-- ============================================

CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pendiente',
  type TEXT DEFAULT 'evidencia',
  track_id INTEGER,
  geometry_id UUID,
  rule_id TEXT,
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  video_file TEXT,
  playback_time DOUBLE PRECISION,
  local_time TIMESTAMPTZ,
  video_time_code TEXT,
  file_path TEXT,
  file_size BIGINT,
  file_hash TEXT,
  original_filename TEXT,
  sync_status TEXT DEFAULT 'pendiente',
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  viewer_id TEXT
);

CREATE INDEX idx_evidence_status ON evidence(status);
CREATE INDEX idx_evidence_created_at ON evidence(created_at DESC);
CREATE INDEX idx_evidence_track_id ON evidence(track_id);
CREATE INDEX idx_evidence_viewer_id ON evidence(viewer_id);

-- ============================================
-- INFRACCIONES
-- ============================================

CREATE TABLE infractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
  plate TEXT,
  make_model TEXT,
  color TEXT,
  description TEXT,
  severity TEXT CHECK (severity IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
  rule_category TEXT,
  legal_base TEXT,
  audit_result JSONB DEFAULT '{}',
  reasoning TEXT[],
  image_url TEXT,
  extra_snapshots TEXT[],
  zoom_snapshots TEXT[],
  video_clip_url TEXT,
  ocr_results TEXT[],
  plate_ocr TEXT,
  plate_ocr_candidates TEXT[],
  time TEXT,
  playback_time DOUBLE PRECISION,
  local_time TIMESTAMPTZ,
  video_time_code TEXT,
  visual_timestamp TEXT,
  telemetry JSONB DEFAULT '{}',
  report_path TEXT,
  report_generated_at TIMESTAMPTZ,
  validation_status TEXT DEFAULT 'pendiente',
  validated_at TIMESTAMPTZ,
  operator_id TEXT,
  roi_history TEXT[],
  infraction_location TEXT,
  extra_data JSONB DEFAULT '{}',
  viewer_id TEXT
);

CREATE INDEX idx_infractions_created_at ON infractions(created_at DESC);
CREATE INDEX idx_infractions_plate ON infractions(plate);
CREATE INDEX idx_infractions_severity ON infractions(severity);
CREATE INDEX idx_infractions_validation_status ON infractions(validation_status);
CREATE INDEX idx_infractions_time ON infractions(time);

-- ============================================
-- INCIDENTS (alias)
-- ============================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  evidence_id UUID,
  plate TEXT,
  make_model TEXT,
  color TEXT,
  description TEXT,
  severity TEXT CHECK (severity IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
  rule_category TEXT,
  legal_base TEXT,
  audit_result JSONB DEFAULT '{}',
  reasoning TEXT[],
  image_url TEXT,
  extra_snapshots TEXT[],
  zoom_snapshots TEXT[],
  video_clip_url TEXT,
  ocr_results TEXT[],
  plate_ocr TEXT,
  time TEXT,
  playback_time DOUBLE PRECISION,
  local_time TIMESTAMPTZ,
  video_time_code TEXT,
  visual_timestamp TEXT,
  telemetry JSONB DEFAULT '{}',
  report_path TEXT,
  report_generated_at TIMESTAMPTZ,
  validation_status TEXT DEFAULT 'pending',
  validated_at TIMESTAMPTZ,
  operator_id TEXT,
  roi_history TEXT[],
  infraction_location TEXT,
  extra_data JSONB DEFAULT '{}',
  viewer_id TEXT
);

-- ============================================
-- AUDIT_JOBS
-- ============================================

CREATE TABLE audit_jobs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pendiente',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  track_state JSONB DEFAULT '{}',
  geometry_state JSONB DEFAULT '{}',
  snapshot JSONB DEFAULT '{}',
  directives TEXT,
  audit_preset TEXT,
  rule_id TEXT,
  audit_result JSONB,
  error_message TEXT,
  viewer_id TEXT
);

CREATE INDEX idx_audit_jobs_status ON audit_jobs(status);
CREATE INDEX idx_audit_jobs_created_at ON audit_jobs(created_at DESC);

-- ============================================
-- GEOMETRY_LINES
-- ============================================

CREATE TABLE geometry_lines (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  x1 DOUBLE PRECISION NOT NULL,
  y1 DOUBLE PRECISION NOT NULL,
  x2 DOUBLE PRECISION NOT NULL,
  y2 DOUBLE PRECISION NOT NULL,
  points JSONB,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  violation_kind TEXT,
  roi_sequence_ids TEXT[],
  roi_sequence_labels TEXT[],
  analysis_context TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  preset_id TEXT
);

CREATE INDEX idx_geometry_lines_type ON geometry_lines(type);
CREATE INDEX idx_geometry_lines_enabled ON geometry_lines(enabled);

-- ============================================
-- FORENSIC_RULES
-- ============================================

CREATE TABLE forensic_rules (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
  legal_base TEXT,
  geometry_ids TEXT[],
  sequence JSONB,
  min_dwell_time INTEGER,
  analysis_prompt TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0
);

-- ============================================
-- REPORTS
-- ============================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  file_hash TEXT,
  total_videos INTEGER DEFAULT 0,
  total_infractiones INTEGER DEFAULT 0,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  infraction_ids UUID[],
  metadata JSONB DEFAULT '{}',
  sync_status TEXT DEFAULT 'pendiente',
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  operator_id TEXT
);

CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_sync_status ON reports(sync_status);

-- ============================================
-- SYSTEM_LOGS
-- ============================================

CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  viewer_id TEXT,
  user_id TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_type ON system_logs(type);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'operador',
  auth_id TEXT,
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- VIDEO_SOURCES
-- ============================================

CREATE TABLE video_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  video_path TEXT,
  video_url TEXT,
  ip_url TEXT,
  ip_username TEXT,
  ip_password TEXT,
  batch_paths TEXT[],
  preset_id TEXT,
  metadata JSONB DEFAULT '{}',
  operator_id TEXT
);

-- ============================================
-- DETECTION_PRESETS
-- ============================================

CREATE TABLE detection_presets (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE
);

INSERT INTO detection_presets (id, name, label, description, config, is_active) VALUES
('scout', 'SCOUT', 'Explorador', 'Deteccion ligera', '{"confidenceThreshold": 0.5}'::jsonb, true),
('sentry', 'SENTINEL', 'Centinela', 'Deteccion equilibrada', '{"confidenceThreshold": 0.6}'::jsonb, false),
('warden', 'WARDEN', 'Guardian', 'Deteccion estricta', '{"confidenceThreshold": 0.7}'::jsonb, false);

-- ============================================
-- AUDIT_PRESETS
-- ============================================

CREATE TABLE audit_presets (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  is_active BOOLEAN DEFAULT FALSE
);

INSERT INTO audit_presets (id, name, label, description, instructions, is_active) VALUES
('flash', 'FLASH', 'Flash', 'Deteccion rapida', 'Analiza violaciones claras', true),
('tactical', 'TACTICAL', 'Tactico', 'Analisis detallado', 'Analisis tactico con clasificacion', false);

-- ============================================
-- FILE_SYNC_LOGS
-- ============================================

CREATE TABLE file_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  target_table TEXT,
  target_id UUID,
  status TEXT DEFAULT 'exitoso',
  error_message TEXT,
  bytes_transferred BIGINT DEFAULT 0,
  sync_duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  viewer_id TEXT,
  operator_id TEXT
);

-- ============================================
-- LUGARES_INFRACCION
CREATE TABLE lugares_infraccion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  direccion TEXT,
  municipio TEXT DEFAULT 'Daganzo de Arriba',
  provincia TEXT DEFAULT 'Madrid',
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0
);

INSERT INTO lugares_infraccion (id, nombre, direccion, municipio, activo, orden) VALUES
(uuid_generate_v4(), 'Centro Urbano', 'Calle Principal', 'Daganzo de Arriba', true, 1),
(uuid_generate_v4(), 'Plaza Mayor', 'Plaza Mayor', 'Daganzo de Arriba', true, 2),
(uuid_generate_v4(), 'Calle Real', 'Calle Real', 'Daganzo de Arriba', true, 3),
(uuid_generate_v4(), 'Avenida Constitucion', 'Avenida Constitucion', 'Daganzo de Arriba', true, 4),
(uuid_generate_v4(), 'Carretera M-100', 'Carretera M-100', 'Daganzo de Arriba', true, 5),
(uuid_generate_v4(), 'Cruce del Pueblo', 'Cruce Principal', 'Daganzo de Arriba', true, 6);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evidence_updated_at BEFORE UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_infractions_updated_at BEFORE UPDATE ON infractions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_geometry_lines_updated_at BEFORE UPDATE ON geometry_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forensic_rules_updated_at BEFORE UPDATE ON forensic_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_sources_updated_at BEFORE UPDATE ON video_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_detection_presets_updated_at BEFORE UPDATE ON detection_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audit_presets_updated_at BEFORE UPDATE ON audit_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lugares_infraccion_updated_at BEFORE UPDATE ON lugares_infraccion FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE geometry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lugares_infraccion ENABLE ROW LEVEL SECURITY;

-- Politicas RLS
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read evidence'; IF NOT FOUND THEN CREATE POLICY "Public read evidence" ON evidence FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public insert evidence'; IF NOT FOUND THEN CREATE POLICY "Public insert evidence" ON evidence FOR INSERT WITH CHECK (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read infractions'; IF NOT FOUND THEN CREATE POLICY "Public read infractions" ON infractions FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public insert infractions'; IF NOT FOUND THEN CREATE POLICY "Public insert infractions" ON infractions FOR INSERT WITH CHECK (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read geometry_lines'; IF NOT FOUND THEN CREATE POLICY "Public read geometry_lines" ON geometry_lines FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read forensic_rules'; IF NOT FOUND THEN CREATE POLICY "Public read forensic_rules" ON forensic_rules FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read system_logs'; IF NOT FOUND THEN CREATE POLICY "Public read system_logs" ON system_logs FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read detection_presets'; IF NOT FOUND THEN CREATE POLICY "Public read detection_presets" ON detection_presets FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read audit_presets'; IF NOT FOUND THEN CREATE POLICY "Public read audit_presets" ON audit_presets FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public read lugares_infraccion'; IF NOT FOUND THEN CREATE POLICY "Public read lugares_infraccion" ON lugares_infraccion FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public insert lugares_infraccion'; IF NOT FOUND THEN CREATE POLICY "Public insert lugares_infraccion" ON lugares_infraccion FOR INSERT WITH CHECK (true); END IF; END $$;
DO $$ BEGIN PERFORM * FROM pg_policies WHERE policyname = 'Public update lugares_infraccion'; IF NOT FOUND THEN CREATE POLICY "Public update lugares_infraccion" ON lugares_infraccion FOR UPDATE USING (true); END IF; END $$;

-- ============================================
-- VERIFICAR
-- ============================================

SELECT 'Tablas creadas: ' || count(*)::text FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';