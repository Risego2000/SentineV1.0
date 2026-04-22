-- ============================================
-- Evidence Files Table Migration
-- Add support for storing evidence files in Supabase Storage
-- ============================================

-- Create evidence_files table
CREATE TABLE IF NOT EXISTS evidence_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infraction_id UUID NOT NULL REFERENCES infractions(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'video')),
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID, -- FK to users, optional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}', -- width, height, duration, etc.
  is_forensic BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX idx_evidence_files_infraction_id ON evidence_files(infraction_id);
CREATE INDEX idx_evidence_files_created_at ON evidence_files(created_at DESC);
CREATE INDEX idx_evidence_files_file_type ON evidence_files(file_type);

-- Enable RLS
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read
CREATE POLICY "Authenticated users can read evidence files" ON evidence_files
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- RLS Policy: Service role can insert
CREATE POLICY "Service role can insert evidence files" ON evidence_files
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policy: Service role can delete
CREATE POLICY "Service role can delete evidence files" ON evidence_files
  FOR DELETE
  USING (auth.role() = 'service_role');

-- RLS Policy: Service role can update
CREATE POLICY "Service role can update evidence files" ON evidence_files
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- Storage Bucket Policies
-- ============================================

-- Ensure infraction-evidence bucket exists and has proper policies
-- (Run this in Supabase Storage settings or via API)

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Authenticated read infraction-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Service role manage infraction-evidence" ON storage.objects;

-- Policy: Authenticated users can read from infraction-evidence bucket
CREATE POLICY "Authenticated read infraction-evidence" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'infraction-evidence'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Policy: Service role can manage infraction-evidence bucket
CREATE POLICY "Service role manage infraction-evidence" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'infraction-evidence'
    AND auth.role() = 'service_role'
  )
  WITH CHECK (
    bucket_id = 'infraction-evidence'
    AND auth.role() = 'service_role'
  );
