-- ============================================
-- Sentinel V16 - Migration: Add sync columns
-- Run this in your Supabase SQL Editor FIRST
-- ============================================

-- Add sync columns to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Add sync columns to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create file_sync_logs table
CREATE TABLE IF NOT EXISTS file_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'modified', 'synced', 'failed', 'deleted')),
  source_type TEXT NOT NULL CHECK (source_type IN ('local_folder', 'supabase_storage', 'api_upload')),
  source_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  target_table TEXT,
  target_id UUID,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  bytes_transferred BIGINT DEFAULT 0,
  sync_duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  viewer_id TEXT,
  operator_id TEXT
);

-- Add indexes for file_sync_logs
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_created_at ON file_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_target_table ON file_sync_logs(target_table);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_status ON file_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_file_sync_logs_source_path ON file_sync_logs(source_path);

-- Add RLS to file_sync_logs
ALTER TABLE file_sync_logs ENABLE ROW LEVEL SECURITY;

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

-- Add indexes to existing tables if not exists
CREATE INDEX IF NOT EXISTS idx_evidence_sync_status ON evidence(sync_status);
CREATE INDEX IF NOT EXISTS idx_evidence_file_path ON evidence(file_path);
CREATE INDEX IF NOT EXISTS idx_reports_sync_status ON reports(sync_status);
CREATE INDEX IF NOT EXISTS idx_reports_file_path ON reports(file_path);
