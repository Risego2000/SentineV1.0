# SQL Master Guide - Sentinel AI Database Optimization

## 📋 Archivo de SQL por Prioridad

### ✅ NIVEL 1: EJECUTAR PRIMERO (Sin riesgo)

**Archivo:** `database/indexes-minimal.sql`
**Prioridad:** 🟢 CRÍTICA
**Riesgo:** ✅ SEGURO (IF NOT EXISTS)
**Tiempo:** 1-2 minutos

**Qué hace:**
- Crea 5 índices esenciales
- Configura autovacuum
- 10-100x más rápido en búsquedas

**SQL Completo para copiar/pegar:**
```sql
-- Supabase Postgres Optimization - Sentinel AI
-- MINIMAL VERSION - Just essential indexes
-- No user tracking columns assumed

-- Index expedients by state (most common filter)
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

-- Index expedients by creation time (for sorting/pagination)
CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Index infractions by plate (exact match lookups)
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

-- Index infractions by creation time
CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Index evidence by expedient (for joins)
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);

-- Enable autovacuum for frequently modified tables
ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE evidence SET (autovacuum_vacuum_scale_factor = 0.05);
```

---

### ⚠️ NIVEL 2: OPCIONAL (Requiere customización)

**Archivo:** `database/rls-policies-fixed.sql`
**Prioridad:** 🟡 ALTA (Si necesitas seguridad por usuario)
**Riesgo:** ⚠️ REVISAR (Asume `users` table)
**Tiempo:** 2-5 minutos

**Qué hace:**
- Agrega Row-Level Security (RLS)
- Operadores ven solo sus datos
- Supervisores ven todo
- Administradores controlan todo

**Status:** ❌ NO EJECUTAR AÚN - necesita que confirmes que tienes tabla `users`

**Si tienes tabla `users`, ejecuta:**
```sql
-- Enable RLS on critical tables
ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Expedients: Operators SELECT only their own
CREATE POLICY "expedients_select_own"
  ON expedients FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Expedients: Operators UPDATE only their own
CREATE POLICY "expedients_update_own"
  ON expedients FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Expedients: INSERT (operators)
CREATE POLICY "expedients_insert"
  ON expedients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OPERATOR', 'SUPERVISOR', 'ADMIN')
    )
  );

-- Expedients: DELETE (supervisors/admins only)
CREATE POLICY "expedients_delete"
  ON expedients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Infractions: Everyone reads, admins modify
CREATE POLICY "infractions_read"
  ON infractions FOR SELECT
  USING (true);

CREATE POLICY "infractions_insert"
  ON infractions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

CREATE POLICY "infractions_update"
  ON infractions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Evidence: Access control by expedient
CREATE POLICY "evidence_select"
  ON evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM expedients
      WHERE expedients.id = evidence.expedient_id
      AND (
        auth.uid() = expedients.created_by
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('SUPERVISOR', 'ADMIN')
        )
      )
    )
  );

CREATE POLICY "evidence_insert"
  ON evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expedients
      WHERE expedients.id = evidence.expedient_id
      AND auth.uid() = expedients.created_by
    )
  );

-- Permissions
GRANT SELECT ON expedients TO authenticated;
GRANT INSERT, UPDATE ON expedients TO authenticated;
GRANT SELECT ON infractions TO authenticated;
GRANT SELECT ON evidence TO authenticated;
```

---

### ❌ NIVEL 3: NO USAR (Problemas)

Estos archivos tienen errores y NO DEBEN EJECUTARSE:

| Archivo | Problema | Razón |
|---------|----------|-------|
| `schema-optimization.sql` | Columna `deleted_at` no existe | ❌ ERROR |
| `schema-optimization-fixed.sql` | Columna `created_by` no existe | ❌ ERROR |
| `rls-policies.sql` | Columna `deleted_at` no existe | ❌ ERROR |
| `query-optimization.sql` | Solo ejemplos de patrones | ℹ️ REFERENCIA |

---

## 🚀 Ejecución Recomendada

### Paso 1: Ejecutar Índices (AHORA)
```sql
-- Copiar TODO el contenido de database/indexes-minimal.sql
-- Pegar en Supabase Dashboard → SQL Editor
-- Ejecutar ✅
```

### Paso 2: Verificar Índices
```sql
-- Ejecutar esto para verificar:
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('expedients', 'infractions', 'evidence')
ORDER BY tablename, indexname;
```

Deberías ver:
- idx_expedients_state
- idx_expedients_created_at
- idx_infractions_plate
- idx_infractions_created_at
- idx_evidence_expedient_id

### Paso 3: Enable Connection Pooling
En Supabase Dashboard:
1. Project → Settings → Database
2. Connection Pooling → Enable
3. Mode: Transaction
4. Pool Size: 25

### Paso 4: (OPCIONAL) RLS Policies
Si tienes tabla `users` y quieres seguridad por usuario:
```sql
-- Ejecutar database/rls-policies-fixed.sql
-- PERO primero confirma que tienes columna created_by en expedients
```

---

## 📊 Resumen de Archivos SQL

| Archivo | Ejecutar | Descripción |
|---------|----------|-------------|
| `indexes-minimal.sql` | ✅ AHORA | 5 índices esenciales + autovacuum |
| `rls-policies-fixed.sql` | ⚠️ SI APLICA | RLS si tienes tabla users |
| `query-optimization.sql` | 📖 REFERENCIA | Patrones de queries optimizadas |
| (Otros) | ❌ NO USAR | Errores de esquema |

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo ejecutar todos a la vez?**
R: No. Solo ejecuta `indexes-minimal.sql`. Los otros tienen problemas.

**P: ¿Cuánto tiempo tardan?**
R: Índices = 1-2 minutos. RLS = 2-5 minutos.

**P: ¿Es seguro?**
R: Sí, todos tienen `IF NOT EXISTS` - no causa errores si ya existen.

**P: ¿Qué pasa si tengo la columna `created_by`?**
R: Avísame y creo versión con esa columna para RLS.

**P: ¿Cómo verifico que funcionó?**
R: Ejecuta:
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'expedients';
```

Deberías ver 2 índices nuevos.

---

## ✅ Checklist

- [ ] Ejecutar `indexes-minimal.sql` en Supabase SQL Editor
- [ ] Verificar índices con query de verificación
- [ ] Enable Connection Pooling en Dashboard
- [ ] (Opcional) Preguntar sobre tabla `users` para RLS
- [ ] (Opcional) Ejecutar RLS policies si tienes `users` table

---

## 🆘 Si hay errores

1. Copia el error exacto
2. Revisa qué columnas existen:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'expedients';
   ```
3. Avísame y adapto el SQL a tus columnas reales

**¡Listo! 🚀**
