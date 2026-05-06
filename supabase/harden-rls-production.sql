-- ============================================================================
-- PRODUCTION RLS HARDENING (minimum privilege)
-- Run this in Supabase SQL Editor for production environments.
-- ============================================================================

BEGIN;

-- Keep RLS enabled
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedient_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

-- Remove permissive compatibility policies
DROP POLICY IF EXISTS infractions_read_anon_auth ON public.infractions;
DROP POLICY IF EXISTS expedients_read_anon_auth ON public.expedients;
DROP POLICY IF EXISTS expedient_images_read_anon_auth ON public.expedient_images;
DROP POLICY IF EXISTS evidence_select_own ON public.evidence;
DROP POLICY IF EXISTS evidence_insert_any ON public.evidence;
DROP POLICY IF EXISTS expedient_images_insert_any ON public.expedient_images;
DROP POLICY IF EXISTS expedient_images_select_own ON public.expedient_images;

-- Infractions: authenticated read only
CREATE POLICY infractions_read_authenticated
  ON public.infractions
  FOR SELECT
  TO authenticated
  USING (true);

-- Expedients: authenticated read only
CREATE POLICY expedients_read_authenticated
  ON public.expedients
  FOR SELECT
  TO authenticated
  USING (true);

-- Expedient images: authenticated read, authenticated insert
CREATE POLICY expedient_images_read_authenticated
  ON public.expedient_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY expedient_images_insert_authenticated
  ON public.expedient_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Evidence: authenticated read/insert
CREATE POLICY evidence_read_authenticated
  ON public.evidence
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY evidence_insert_authenticated
  ON public.evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Explicitly revoke anon table read grants for sensitive tables
REVOKE SELECT ON TABLE public.infractions FROM anon;
REVOKE SELECT ON TABLE public.expedients FROM anon;
REVOKE SELECT ON TABLE public.expedient_images FROM anon;
REVOKE SELECT ON TABLE public.evidence FROM anon;

COMMIT;

