-- ============================================================================
-- FIX ACCESS FOR FRONTEND (anon/authenticated)
-- Use in Supabase SQL Editor when the UI gets 403 on infractions/expedient_images
-- ============================================================================

-- Ensure schema/table privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.infractions TO anon, authenticated;
GRANT SELECT ON TABLE public.expedient_images TO anon, authenticated;
GRANT SELECT ON TABLE public.expedients TO anon, authenticated;

-- Keep RLS enabled
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedient_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

-- Remove conflicting old policies if present
DROP POLICY IF EXISTS infractions_user_isolation ON public.infractions;
DROP POLICY IF EXISTS expedient_images_user_isolation ON public.expedient_images;
DROP POLICY IF EXISTS expedients_user_isolation ON public.expedients;
DROP POLICY IF EXISTS infractions_read_anon_auth ON public.infractions;
DROP POLICY IF EXISTS expedient_images_read_anon_auth ON public.expedient_images;
DROP POLICY IF EXISTS expedients_read_anon_auth ON public.expedients;

-- Read policies for frontend access
CREATE POLICY infractions_read_anon_auth
  ON public.infractions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY expedient_images_read_anon_auth
  ON public.expedient_images
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY expedients_read_anon_auth
  ON public.expedients
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Optional sanity checks
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('infractions', 'expedient_images', 'expedients')
-- ORDER BY tablename, policyname;
