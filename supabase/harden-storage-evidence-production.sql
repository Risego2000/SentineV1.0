-- ============================================================================
-- STORAGE HARDENING FOR EVIDENCE BUCKET (production)
-- Converts evidence bucket to private and enforces authenticated access.
-- ============================================================================

BEGIN;

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public, owner, created_at, updated_at)
VALUES ('evidence', 'evidence', false, NULL, now(), now())
ON CONFLICT (id) DO UPDATE
SET public = false,
    updated_at = now();

-- Remove permissive policies if present
DROP POLICY IF EXISTS "Public Read Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Delete Evidence" ON storage.objects;

-- Read own/private evidence only for authenticated users
CREATE POLICY "Evidence Read Authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidence');

-- Upload evidence only for authenticated users
CREATE POLICY "Evidence Upload Authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'evidence');

-- Delete evidence only for authenticated users
CREATE POLICY "Evidence Delete Authenticated"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'evidence');

COMMIT;

