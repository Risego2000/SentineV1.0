-- ============================================
-- Sentinel V16 - Complete Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Evidence: Pre-processed evidence awaiting audit
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  type TEXT NOT NULL DEFAULT 'evidence' CHECK (type IN ('evidence', 'infraction')),

  -- Tracking info
  track_id INTEGER,
  geometry_id UUID,
  rule_id TEXT,

  -- Evidence data (JSONB for flexibility)
  data JSONB DEFAULT '{}',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  video_file TEXT,
  playback_time DOUBLE PRECISION,
  local_time TIMESTAMPTZ,
  video_time_code TEXT,

  -- File tracking (for auto-sync)
  file_path TEXT,
  file_size BIGINT,
  file_hash TEXT,
  original_filename TEXT,

  -- Sync status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Viewer reference
  viewer_id TEXT
);

-- Infractions: Confirmed violation records (also referenced as incidents)
CREATE TABLE IF NOT EXISTS infractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  
  -- Evidence reference
  evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
  
  -- Core infraction data
  plate TEXT,
  make_model TEXT,
  color TEXT,
  description TEXT,
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  rule_category TEXT,
  legal_base TEXT,
  
  -- Audit result
  audit_result JSONB DEFAULT '{}',
  
  -- Reasoning steps
  reasoning TEXT[],
  
  -- Visual evidence (URLs from storage)
  image_url TEXT,
  extra_snapshots TEXT[],
  zoom_snapshots TEXT[],
  video_clip_url TEXT,
  
  -- OCR results
  ocr_results TEXT[],
  plate_ocr TEXT,
  plate_ocr_candidates TEXT[],
  
  -- Timestamps
  time TEXT,
  playback_time DOUBLE PRECISION,
  local_time TIMESTAMPTZ,
  video_time_code TEXT,
  visual_timestamp TEXT,
  
  -- Telemetry
  telemetry JSONB DEFAULT '{}',
  
  -- Report
  report_path TEXT,
  report_generated_at TIMESTAMPTZ,
  
  -- Validation
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  validated_at TIMESTAMPTZ,
  operator_id TEXT,
  
  -- ROI sequence for forbidden turns
  roi_history TEXT[],
  
  -- Extra
  extra_data JSONB DEFAULT '{}',
  
  -- Viewer reference
  viewer_id TEXT
);

-- Alias table for incidents (backward compatibility)
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  
  evidence_id UUID,
  plate TEXT,
  make_model TEXT,
  color TEXT,
  description TEXT,
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
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
  extra_data JSONB DEFAULT '{}',
  viewer_id TEXT
);

-- Audit Jobs: Forensic analysis job queue
CREATE TABLE IF NOT EXISTS audit_jobs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cleared', 'failed', 'aborted')),
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Frozen snapshots
  track_state JSONB NOT NULL DEFAULT '{}',
  geometry_state JSONB NOT NULL DEFAULT '{}',
  snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Job config
  directives TEXT,
  audit_preset TEXT,
  rule_id TEXT,
  
  -- Result
  audit_result JSONB,
  error_message TEXT,
  
  -- Viewer
  viewer_id TEXT
);

-- Geometry Lines: Zone/line configurations
CREATE TABLE IF NOT EXISTS geometry_lines (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Geometry data
  x1 DOUBLE PRECISION NOT NULL,
  y1 DOUBLE PRECISION NOT NULL,
  x2 DOUBLE PRECISION NOT NULL,
  y2 DOUBLE PRECISION NOT NULL,
  points JSONB,
  
  -- Display
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('forbidden', 'lane_divider', 'stop_line', 'box_junction', 'pedestrian', 'bus_lane', 'roi_general', 'roi_turn', 'double_row', 'prohibited_parking')),
  violation_kind TEXT,
  
  -- For turn sequences
  roi_sequence_ids TEXT[],
  roi_sequence_labels TEXT[],
  
  -- Analysis
  analysis_context TEXT,
  
  -- Config
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  
  -- Preset reference
  preset_id TEXT
);

-- Forensic Rules: Rule configurations
CREATE TABLE IF NOT EXISTS forensic_rules (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('line_crossing', 'stop_violation', 'forbidden_direction', 'forbidden_turn', 'zone_dwell', 'roi_entry')),
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  legal_base TEXT,
  
  -- Geometry references (text - stores type identifiers like 'stop_line', 'pedestrian', etc.)
  geometry_ids TEXT[],
  
  -- Sequence for forbidden turns
  sequence JSONB,
  min_dwell_time INTEGER,
  
  -- AI
  analysis_prompt TEXT,
  
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0
);

-- Reports: Generated PDF report history
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Report info
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,

  -- File tracking (for auto-sync)
  file_size BIGINT,
  file_hash TEXT,

  -- Stats
  total_videos INTEGER DEFAULT 0,
  total_infractiones INTEGER DEFAULT 0,

  -- Period
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,

  -- Infractions in report
  infraction_ids UUID[],

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Sync status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Generated by
  operator_id TEXT
);

-- System Logs: Event logging
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  type TEXT NOT NULL CHECK (type IN ('INFO', 'WARN', 'ERROR', 'AI', 'CORE', 'SUCCESS', 'DEBUG')),
  content TEXT NOT NULL,
  
  -- Context
  viewer_id TEXT,
  user_id TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Users: User/operator management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  email TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
  
  -- Auth
  auth_id TEXT,
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  active BOOLEAN DEFAULT TRUE
);

-- Video Sources: Saved video source configurations
CREATE TABLE IF NOT EXISTS video_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'live', 'ip', 'batch')),
  
  -- Video file path (for uploads)
  video_path TEXT,
  video_url TEXT,
  
  -- IP Camera config
  ip_url TEXT,
  ip_username TEXT,
  ip_password TEXT,
  
  -- Batch config
  batch_paths TEXT[],
  
  -- Preset reference
  preset_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Created by
  operator_id TEXT
);

-- Detection Presets: Engine configurations
CREATE TABLE IF NOT EXISTS detection_presets (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  
  -- Engine config
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Active status
  is_active BOOLEAN DEFAULT FALSE
);

-- Audit Presets: Audit instruction sets
CREATE TABLE IF NOT EXISTS audit_presets (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,

  -- Instructions
  instructions TEXT,

  -- Active status
  is_active BOOLEAN DEFAULT FALSE
);

-- File Sync Logs: Track automatic file synchronization events
CREATE TABLE IF NOT EXISTS file_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sync event type
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'modified', 'synced', 'failed', 'deleted')),

  -- Source info
  source_type TEXT NOT NULL CHECK (source_type IN ('local_folder', 'supabase_storage', 'api_upload')),
  source_path TEXT NOT NULL,

  -- File info
  filename TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,

  -- Target table
  target_table TEXT,
  target_id UUID,

  -- Sync result
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  bytes_transferred BIGINT DEFAULT 0,

  -- Sync metadata
  sync_duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,

  -- Viewer/operator reference
  viewer_id TEXT,
  operator_id TEXT
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_track_id ON evidence(track_id);
CREATE INDEX IF NOT EXISTS idx_evidence_viewer_id ON evidence(viewer_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sync_status ON evidence(sync_status);
CREATE INDEX IF NOT EXISTS idx_evidence_file_path ON evidence(file_path);

CREATE INDEX IF NOT EXISTS idx_infractions_created_at ON infractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infractions_plate ON infractions(plate);
CREATE INDEX IF NOT EXISTS idx_infractions_severity ON infractions(severity);
CREATE INDEX IF NOT EXISTS idx_infractions_validation_status ON infractions(validation_status);
CREATE INDEX IF NOT EXISTS idx_infractions_time ON infractions(time);
CREATE INDEX IF NOT EXISTS idx_infractions_viewer_id ON infractions(viewer_id);

CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_plate ON incidents(plate);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_validation_status ON incidents(validation_status);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_created_at ON audit_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_geometry_lines_type ON geometry_lines(type);
CREATE INDEX IF NOT EXISTS idx_geometry_lines_enabled ON geometry_lines(enabled);

CREATE INDEX IF NOT EXISTS idx_forensic_rules_type ON forensic_rules(type);
CREATE INDEX IF NOT EXISTS idx_forensic_rules_enabled ON forensic_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_sync_status ON reports(sync_status);
CREATE INDEX IF NOT EXISTS idx_reports_file_path ON reports(file_path);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(type);

CREATE INDEX IF NOT EXISTS idx_file_sync_logs_created_at ON file_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_target_table ON file_sync_logs(target_table);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_status ON file_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_source_path ON file_sync_logs(source_path);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for evidence
DROP TRIGGER IF EXISTS update_evidence_updated_at ON evidence;
CREATE TRIGGER update_evidence_updated_at
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for infractions
DROP TRIGGER IF EXISTS update_infractions_updated_at ON infractions;
CREATE TRIGGER update_infractions_updated_at
  BEFORE UPDATE ON infractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for incidents
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for geometry_lines
DROP TRIGGER IF EXISTS update_geometry_lines_updated_at ON geometry_lines;
CREATE TRIGGER update_geometry_lines_updated_at
  BEFORE UPDATE ON geometry_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for forensic_rules
DROP TRIGGER IF EXISTS update_forensic_rules_updated_at ON forensic_rules;
CREATE TRIGGER update_forensic_rules_updated_at
  BEFORE UPDATE ON forensic_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for video_sources
DROP TRIGGER IF EXISTS update_video_sources_updated_at ON video_sources;
CREATE TRIGGER update_video_sources_updated_at
  BEFORE UPDATE ON video_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for detection_presets
DROP TRIGGER IF EXISTS update_detection_presets_updated_at ON detection_presets;
CREATE TRIGGER update_detection_presets_updated_at
  BEFORE UPDATE ON detection_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for audit_presets
DROP TRIGGER IF EXISTS update_audit_presets_updated_at ON audit_presets;
CREATE TRIGGER update_audit_presets_updated_at
  BEFORE UPDATE ON audit_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
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

-- Public read access (adjust as needed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read evidence') THEN
    CREATE POLICY "Public read evidence" ON evidence FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert evidence') THEN
    CREATE POLICY "Public insert evidence" ON evidence FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update evidence') THEN
    CREATE POLICY "Public update evidence" ON evidence FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read infractions') THEN
    CREATE POLICY "Public read infractions" ON infractions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert infractions') THEN
    CREATE POLICY "Public insert infractions" ON infractions FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update infractions') THEN
    CREATE POLICY "Public update infractions" ON infractions FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read incidents') THEN
    CREATE POLICY "Public read incidents" ON incidents FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read geometry_lines') THEN
    CREATE POLICY "Public read geometry_lines" ON geometry_lines FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert geometry_lines') THEN
    CREATE POLICY "Public insert geometry_lines" ON geometry_lines FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update geometry_lines') THEN
    CREATE POLICY "Public update geometry_lines" ON geometry_lines FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public delete geometry_lines') THEN
    CREATE POLICY "Public delete geometry_lines" ON geometry_lines FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read forensic_rules') THEN
    CREATE POLICY "Public read forensic_rules" ON forensic_rules FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read reports') THEN
    CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert reports') THEN
    CREATE POLICY "Public insert reports" ON reports FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read system_logs') THEN
    CREATE POLICY "Public read system_logs" ON system_logs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert system_logs') THEN
    CREATE POLICY "Public insert system_logs" ON system_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to insert logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert system_logs') THEN
    CREATE POLICY "Authenticated insert system_logs" ON system_logs FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'anon'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read users') THEN
    CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read video_sources') THEN
    CREATE POLICY "Public read video_sources" ON video_sources FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read detection_presets') THEN
    CREATE POLICY "Public read detection_presets" ON detection_presets FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read audit_presets') THEN
    CREATE POLICY "Public read audit_presets" ON audit_presets FOR SELECT USING (true);
  END IF;
END $$;

-- File Sync Logs policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read file_sync_logs') THEN
    CREATE POLICY "Public read file_sync_logs" ON file_sync_logs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert file_sync_logs') THEN
    CREATE POLICY "Public insert file_sync_logs" ON file_sync_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access file_sync_logs') THEN
    CREATE POLICY "Service role full access file_sync_logs" ON file_sync_logs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Service role can do everything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access evidence') THEN
    CREATE POLICY "Service role full access evidence" ON evidence FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access infractions') THEN
    CREATE POLICY "Service role full access infractions" ON infractions FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access incidents') THEN
    CREATE POLICY "Service role full access incidents" ON incidents FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access audit_jobs') THEN
    CREATE POLICY "Service role full access audit_jobs" ON audit_jobs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert audit_jobs') THEN
    CREATE POLICY "Public insert audit_jobs" ON audit_jobs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Public read access for audit_jobs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read audit_jobs') THEN
    CREATE POLICY "Public read audit_jobs" ON audit_jobs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update audit_jobs') THEN
    CREATE POLICY "Public update audit_jobs" ON audit_jobs FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access geometry_lines') THEN
    CREATE POLICY "Service role full access geometry_lines" ON geometry_lines FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access forensic_rules') THEN
    CREATE POLICY "Service role full access forensic_rules" ON forensic_rules FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access reports') THEN
    CREATE POLICY "Service role full access reports" ON reports FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access system_logs') THEN
    CREATE POLICY "Service role full access system_logs" ON system_logs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access users') THEN
    CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access video_sources') THEN
    CREATE POLICY "Service role full access video_sources" ON video_sources FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access detection_presets') THEN
    CREATE POLICY "Service role full access detection_presets" ON detection_presets FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access audit_presets') THEN
    CREATE POLICY "Service role full access audit_presets" ON audit_presets FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Evidence files bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Reports bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Video clips bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('clips', 'clips', true)
ON CONFLICT (id) DO NOTHING;

-- Snapshots bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('snapshots', 'snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload to evidence') THEN
    CREATE POLICY "Anyone can upload to evidence" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view evidence files') THEN
    CREATE POLICY "Anyone can view evidence files" ON storage.objects FOR SELECT USING (bucket_id = 'evidence');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload to reports') THEN
    CREATE POLICY "Anyone can upload to reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reports');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view report files') THEN
    CREATE POLICY "Anyone can view report files" ON storage.objects FOR SELECT USING (bucket_id = 'reports');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload to clips') THEN
    CREATE POLICY "Anyone can upload to clips" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clips');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view clips') THEN
    CREATE POLICY "Anyone can view clips" ON storage.objects FOR SELECT USING (bucket_id = 'clips');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload to snapshots') THEN
    CREATE POLICY "Anyone can upload to snapshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view snapshots') THEN
    CREATE POLICY "Anyone can view snapshots" ON storage.objects FOR SELECT USING (bucket_id = 'snapshots');
  END IF;
END $$;

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- NOTE: Tables already added to supabase_realtime publication in previous runs
-- Uncomment if running on fresh database:
-- ALTER PUBLICATION supabase_realtime ADD TABLE audit_jobs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE infractions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE geometry_lines;
-- ALTER PUBLICATION supabase_realtime ADD TABLE system_logs;

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default detection presets
INSERT INTO detection_presets (id, name, label, description, config, is_active)
VALUES 
  ('scout', 'SCOUT', 'Scout', 'Light detection for high FPS', 
   '{"confidenceThreshold": 0.5, "nmsThreshold": 0.4, "detectionSkip": 2, "persistence": 30, "predictionLookahead": 5}'::jsonb, true),
  ('sentinel', 'SENTINEL', 'Sentinel', 'Balanced detection', 
   '{"confidenceThreshold": 0.6, "nmsThreshold": 0.5, "detectionSkip": 1, "persistence": 60, "predictionLookahead": 10}'::jsonb, false),
  ('warden', 'WARDEN', 'Warden', 'Strict detection', 
   '{"confidenceThreshold": 0.7, "nmsThreshold": 0.5, "detectionSkip": 1, "persistence": 90, "predictionLookahead": 15}'::jsonb, false),
  ('shadow', 'SHADOW', 'Shadow', 'Maximum persistence', 
   '{"confidenceThreshold": 0.55, "nmsThreshold": 0.45, "detectionSkip": 1, "persistence": 120, "predictionLookahead": 20}'::jsonb, false)
ON CONFLICT (id) DO NOTHING;

-- Insert default audit presets
INSERT INTO audit_presets (id, name, label, description, instructions, is_active)
VALUES
  ('flash', 'FLASH', 'Flash', 'Quick infraction detection', 
   'Analyze for obvious traffic violations. Focus on vehicle behavior, plate visibility, and clear rule breaches.', true),
  ('tactical', 'TACTICAL', 'Tactical', 'Detailed but fast', 
   'Perform tactical analysis with emphasis on severity classification and legal base verification.', false),
  ('full', 'FULL', 'Full', 'Comprehensive audit', 
   'Full forensic analysis including plate OCR, timecode verification, velocity estimation, and behavior anomaly detection.', false),
  ('standard', 'STANDARD', 'Standard', 'Balanced audit', 
   'Standard analysis covering allViolation aspects with moderate detail.', false),
  ('neural', 'NEURAL', 'Neural', 'AI-enhanced audit', 
   'Advanced neural analysis for complex scenarios and ambiguous violations.', false),
  ('senior', 'SENIOR', 'Senior', 'Expert review', 
   'Senior expert review for edge cases and disputed infractions.', false)
ON CONFLICT (id) DO NOTHING;

-- Insert default forensic rules
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority)
VALUES
  ('rule_stop_line', 'Stop Line Violation', 'stop_violation', 'MEDIUM', 'Art. 151 RGC', ARRAY['stop_line'], 
   'Analyze if the vehicle failed to come to a complete stop at the stop line.', true, 10),
  ('rule_pedestrian_crossing', 'Pedestrian Priority Violation', 'line_crossing', 'HIGH', 'Art. 146 RGC', ARRAY['pedestrian'], 
   'Analyze if the vehicle failed to yield to pedestrians at the crossing.', true, 15),
  ('rule_forbidden_lane', 'Forbidden Lane Invasion', 'forbidden_direction', 'HIGH', 'Art. 144 RGC', ARRAY['forbidden'], 
   'Analyze if the vehicle traveled in a forbidden direction or invaded restricted lane.', true, 12),
  ('rule_solid_line', 'Solid Line Violation', 'line_crossing', 'MEDIUM', 'Art. 143 RGC', ARRAY['lane_divider'], 
   'Analyze if the vehicle crossed a solid line improperly.', true, 8),
  ('rule_bus_lane', 'Bus Lane Violation', 'forbidden_direction', 'LOW', 'Ordenanza Municipal', ARRAY['bus_lane'], 
   'Analyze if an unauthorized vehicle used the bus lane.', true, 5),
  ('rule_box_junction', 'Box Junction Blocking', 'zone_dwell', 'MEDIUM', 'Art. 142 RGC', ARRAY['box_junction'], 
   'Analyze if the vehicle blocked the box junction for more than the allowed time.', true, 14),
  ('rule_roi_general', 'General ROI Audit', 'roi_entry', 'MEDIUM', NULL, ARRAY['roi_general'], 
   'Perform general forensic audit of vehicle in analysis zone.', true, 1)
ON CONFLICT (id) DO NOTHING;