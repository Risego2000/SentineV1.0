-- ============================================================================
-- FRONTEND COMPATIBILITY + ACCESS (idempotent)
-- Target: remove common UI errors on infractions/incidents/expedient_images
-- Run in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 1) Basic privileges for frontend roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.infractions TO anon, authenticated;
GRANT SELECT ON TABLE public.expedients TO anon, authenticated;
GRANT SELECT ON TABLE public.expedient_images TO anon, authenticated;

-- 2) Ensure expected compatibility column exists
ALTER TABLE public.infractions
  ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Optional one-time backfill from validation_status when status is null
UPDATE public.infractions
SET status = validation_status
WHERE status IS NULL
  AND validation_status IS NOT NULL;

-- 3) Keep RLS enabled
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedient_images ENABLE ROW LEVEL SECURITY;

-- 4) Replace read policies with permissive read for anon/authenticated
DROP POLICY IF EXISTS infractions_read_anon_auth ON public.infractions;
DROP POLICY IF EXISTS expedients_read_anon_auth ON public.expedients;
DROP POLICY IF EXISTS expedient_images_read_anon_auth ON public.expedient_images;

CREATE POLICY infractions_read_anon_auth
  ON public.infractions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY expedients_read_anon_auth
  ON public.expedients
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY expedient_images_read_anon_auth
  ON public.expedient_images
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5) Compatibility fallback for legacy frontend query: public.incidents
DROP VIEW IF EXISTS public.incidents;
CREATE VIEW public.incidents AS
SELECT
  i.id,
  i.created_at,
  i.updated_at,
  i.status,
  NULL::uuid AS evidence_id,
  i.plate,
  i.make_model,
  i.color,
  i.description,
  i.severity,
  i.violation_type AS rule_category,
  i.legal_base,
  NULL::jsonb AS audit_result,
  i.image_snapshot AS image_url,
  NULL::text[] AS extra_snapshots,
  NULL::text[] AS zoom_snapshots,
  i.video_clip_path AS video_clip_url,
  i.detection_timestamp::text AS time,
  NULL::double precision AS playback_time,
  i.detection_timestamp::text AS local_time,
  NULL::text AS video_time_code,
  i.detection_timestamp::text AS visual_timestamp,
  NULL::jsonb AS telemetry,
  NULL::text AS report_path,
  NULL::timestamptz AS report_generated_at,
  i.validation_status,
  i.validated_at,
  i.validated_by AS operator_id,
  NULL::jsonb AS extra_data
FROM public.infractions i;

GRANT SELECT ON TABLE public.incidents TO anon, authenticated;

COMMIT;

-- Optional checks:
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='infractions' ORDER BY ordinal_position;
-- SELECT schemaname, tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public' AND tablename IN ('infractions','expedients','expedient_images') ORDER BY tablename, policyname;
