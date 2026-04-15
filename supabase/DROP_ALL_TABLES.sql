-- ============================================
-- DROP ALL TABLES - CUIDADO: Esto borra TODO
-- ============================================

-- Primero deshabilitar RLS
ALTER TABLE evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE infractions DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE geometry_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE video_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE detection_presets DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_presets DISABLE ROW LEVEL SECURITY;
ALTER TABLE file_sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE lugares_infraccion DISABLE ROW LEVEL SECURITY;

-- Borrar tablas en orden (primero las que tienen referencias)
DROP TABLE IF EXISTS evidence CASCADE;
DROP TABLE IF EXISTS infractions CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS audit_jobs CASCADE;
DROP TABLE IF EXISTS geometry_lines CASCADE;
DROP TABLE IF EXISTS forensic_rules CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS video_sources CASCADE;
DROP TABLE IF EXISTS detection_presets CASCADE;
DROP TABLE IF EXISTS audit_presets CASCADE;
DROP TABLE IF EXISTS file_sync_logs CASCADE;
DROP TABLE IF EXISTS lugares_infraccion CASCADE;

-- Verificar que no quedan tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';