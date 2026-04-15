-- ============================================
-- Sentinel V16 - Migration Final
-- Run this to update existing Supabase
-- ============================================

-- Add viewer_id to evidence
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence' AND column_name = 'viewer_id') THEN ALTER TABLE evidence ADD COLUMN viewer_id TEXT; END IF; END $$;

-- Add viewer_id to infractions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infractions' AND column_name = 'viewer_id') THEN ALTER TABLE infractions ADD COLUMN viewer_id TEXT; END IF; END $$;

-- Add reasoning to infractions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infractions' AND column_name = 'reasoning') THEN ALTER TABLE infractions ADD COLUMN reasoning TEXT[]; END IF; END $$;

-- Add plate_ocr_candidates to infractions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infractions' AND column_name = 'plate_ocr_candidates') THEN ALTER TABLE infractions ADD COLUMN plate_ocr_candidates TEXT[]; END IF; END $$;

-- Add roi_history to infractions
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infractions' AND column_name = 'roi_history') THEN ALTER TABLE infractions ADD COLUMN roi_history TEXT[]; END IF; END $$;

-- Add viewer_id to incidents
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'viewer_id') THEN ALTER TABLE incidents ADD COLUMN viewer_id TEXT; END IF; END $$;

-- Add roi_history to incidents
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'roi_history') THEN ALTER TABLE incidents ADD COLUMN roi_history TEXT[]; END IF; END $$;

-- Create indexes
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_evidence_viewer_id') THEN CREATE INDEX idx_evidence_viewer_id ON evidence(viewer_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_infractions_viewer_id') THEN CREATE INDEX idx_infractions_viewer_id ON infractions(viewer_id); END IF; END $$;

-- Change geometry_ids column type from uuid[] to text[] (already text[] or convert if needed)
DO $$ BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forensic_rules' AND column_name = 'geometry_ids' AND data_type = 'ARRAY' AND udt_name = '_uuid') THEN
    ALTER TABLE forensic_rules ALTER COLUMN geometry_ids TYPE TEXT[];
  END IF;
END $$;

-- Insert forensic rules
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_stop_line', 'Stop Line Violation', 'stop_violation', 'MEDIUM', 'Art. 151 RGC', ARRAY['stop_line'], 'Analyze if vehicle failed to stop', true, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_pedestrian', 'Pedestrian Violation', 'line_crossing', 'HIGH', 'Art. 146 RGC', ARRAY['pedestrian'], 'Analyze pedestrian violation', true, 15) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_forbidden_lane', 'Forbidden Lane', 'forbidden_direction', 'HIGH', 'Art. 144 RGC', ARRAY['forbidden'], 'Check forbidden lane', true, 12) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_solid_line', 'Solid Line', 'line_crossing', 'MEDIUM', 'Art. 143 RGC', ARRAY['lane_divider'], 'Check solid line', true, 8) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_bus_lane', 'Bus Lane', 'forbidden_direction', 'LOW', 'Ordenanza', ARRAY['bus_lane'], 'Check bus lane', true, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_box_junction', 'Box Junction', 'zone_dwell', 'MEDIUM', 'Art. 142 RGC', ARRAY['box_junction'], 'Check box junction', true, 14) ON CONFLICT (id) DO NOTHING;
INSERT INTO forensic_rules (id, name, type, severity, legal_base, geometry_ids, analysis_prompt, enabled, priority) VALUES ('rule_roi_general', 'General ROI', 'roi_entry', 'MEDIUM', NULL, ARRAY['roi_general'], 'General audit', true, 1) ON CONFLICT (id) DO NOTHING;