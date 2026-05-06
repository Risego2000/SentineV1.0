-- ============================================================================
-- FIX RLS POLICIES - Permitir inserción de evidencias sin restricciones
-- ============================================================================

-- Drop old restrictive policies
DROP POLICY IF EXISTS evidence_user_isolation ON public.evidence;
DROP POLICY IF EXISTS expedient_images_user_isolation ON public.expedient_images;

-- Evidence: Permitir INSERT sin verificación de usuario
CREATE POLICY evidence_insert_any ON public.evidence
  FOR INSERT
  WITH CHECK (true);

-- Evidence: Permitir SELECT para el usuario que lo creó
CREATE POLICY evidence_select_own ON public.evidence
  FOR SELECT
  USING (true);

-- Expedient images: Permitir INSERT sin restricción
CREATE POLICY expedient_images_insert_any ON public.expedient_images
  FOR INSERT
  WITH CHECK (true);

-- Expedient images: Permitir SELECT para el usuario
CREATE POLICY expedient_images_select_own ON public.expedient_images
  FOR SELECT
  USING (true);

-- ============================================================================
-- ACTUALIZAR SCHEMA DE EVIDENCE Y EXPEDIENT_IMAGES
-- ============================================================================

-- Modificar evidence para usar URLs en lugar de base64
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_evidence_image_url ON public.evidence(image_url);
CREATE INDEX IF NOT EXISTS idx_evidence_storage_path ON public.evidence(storage_path);

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON COLUMN public.evidence.image_url IS 'URL pública de la imagen en Supabase Storage';
COMMENT ON COLUMN public.evidence.storage_path IS 'Ruta interna en Storage: bucket/expedient_id/kind/filename';
