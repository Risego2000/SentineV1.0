-- ============================================
-- Sentinel V16 - Supabase Schema
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
  video_time_code TEXT
);

-- Infractions: Confirmed violation records
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
  
  -- Visual evidence (URLs from storage)
  image_url TEXT,
  extra_snapshots TEXT[],
  zoom_snapshots TEXT[],
  video_clip_url TEXT,
  
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
  
  -- Extra
  extra_data JSONB DEFAULT '{}'
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  type TEXT NOT NULL CHECK (type IN ('forbidden', 'lane_divider', 'stop_line', 'box_junction', 'pedestrian', 'bus_lane', 'roi_general', 'roi_turn')),
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
  
  -- Geometry references
  geometry_ids UUID[],
  
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

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence(status);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_track_id ON evidence(track_id);

CREATE INDEX IF NOT EXISTS idx_infractions_created_at ON infractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infractions_plate ON infractions(plate);
CREATE INDEX IF NOT EXISTS idx_infractions_severity ON infractions(severity);
CREATE INDEX IF NOT EXISTS idx_infractions_validation_status ON infractions(validation_status);
CREATE INDEX IF NOT EXISTS idx_infractions_time ON infractions(time);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_created_at ON audit_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(type);

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

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE geometry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Public read access (adjust as needed)
CREATE POLICY "Public read evidence" ON evidence FOR SELECT USING (true);
CREATE POLICY "Public read infractions" ON infractions FOR SELECT USING (true);
CREATE POLICY "Public read geometry_lines" ON geometry_lines FOR SELECT USING (true);
CREATE POLICY "Public read forensic_rules" ON forensic_rules FOR SELECT USING (true);
CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Public read system_logs" ON system_logs FOR SELECT USING (true);
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access evidence" ON evidence FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access infractions" ON infractions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access audit_jobs" ON audit_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access geometry_lines" ON geometry_lines FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access forensic_rules" ON forensic_rules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access reports" ON reports FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access system_logs" ON system_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for report files
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload to evidence" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence');
CREATE POLICY "Anyone can view evidence files" ON storage.objects FOR SELECT USING (bucket_id = 'evidence');
CREATE POLICY "Anyone can upload to reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reports');
CREATE POLICY "Anyone can view report files" ON storage.objects FOR SELECT USING (bucket_id = 'reports');
