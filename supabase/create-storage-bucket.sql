-- ============================================================================
-- CREATE STORAGE BUCKET FOR EVIDENCE
-- Crear bucket 'evidence' con permisos públicos
-- ============================================================================

-- Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public, owner, created_at, updated_at)
VALUES ('evidence', 'evidence', true, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS POLICIES PARA STORAGE
-- ============================================================================

-- Permitir SELECT (lectura) pública
CREATE POLICY "Public Read Evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence');

-- Permitir INSERT sin autenticación
CREATE POLICY "Public Upload Evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence');

-- Permitir DELETE solo para el owner o admin
CREATE POLICY "Delete Evidence"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'evidence');

-- ============================================================================
-- NOTAS
-- ============================================================================
-- El bucket 'evidence' será público: cualquiera puede ver las imágenes
-- Las URLs serán públicas y accesibles en el futuro: https://...supabase.co/storage/v1/object/public/evidence/...
-- Los videos se pueden incrustar directamente en navegadores
