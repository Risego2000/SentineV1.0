# ALL SQL QUERIES - Sentinel AI Database

## 1️⃣ SQL SEGURO - EJECUTAR PRIMERO

### Descubrir tus tablas reales
```sql
-- Run this FIRST to see your actual tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 2️⃣ SQL MINIMALISTA - SOLO EXPEDIENTS E INFRACTIONS

Si no tienes tabla `evidence`, usa esto:

```sql
-- Essential indexes on expedients
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Essential indexes on infractions
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Performance tuning
ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
```

---

## 3️⃣ SQL COMPLETO - SI TIENES TABLA EVIDENCE

```sql
-- Indexes on expedients
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Indexes on infractions
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Indexes on evidence
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);

-- Performance tuning
ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE evidence SET (autovacuum_vacuum_scale_factor = 0.05);
```

---

## 4️⃣ SQL OPCIONAL - RLS (Seguridad por usuario)

⚠️ **SOLO si tienes columna `created_by` en expedients**

Primero verifica:
```sql
-- Check if created_by column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'expedients' AND column_name = 'created_by';
```

Si existe, corre esto:
```sql
-- Enable RLS
ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;

-- Expedients: SELECT own
CREATE POLICY "expedients_select_own"
  ON expedients FOR SELECT
  USING (auth.uid() = created_by);

-- Expedients: UPDATE own
CREATE POLICY "expedients_update_own"
  ON expedients FOR UPDATE
  USING (auth.uid() = created_by);

-- Expedients: INSERT
CREATE POLICY "expedients_insert"
  ON expedients FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Infractions: Everyone reads
CREATE POLICY "infractions_read"
  ON infractions FOR SELECT
  USING (true);

-- Permissions
GRANT SELECT ON expedients TO authenticated;
GRANT INSERT, UPDATE ON expedients TO authenticated;
GRANT SELECT ON infractions TO authenticated;
```

---

## 5️⃣ SQL VERIFICACIÓN - Después de ejecutar

```sql
-- Verify indexes were created
SELECT 
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public'
  AND (tablename IN ('expedients', 'infractions', 'evidence'))
ORDER BY tablename, indexname;
```

**Expected result:** Should show your new indexes

---

## 6️⃣ SQL DIAGNOSTIC - Checa tu schema

```sql
-- See all columns in expedients
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expedients'
ORDER BY ordinal_position;

-- See all columns in infractions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'infractions'
ORDER BY ordinal_position;

-- See all columns in evidence (if exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evidence'
ORDER BY ordinal_position;
```

---

## 7️⃣ SQL OPTIONAL INDEXES - Uncomment if you use these

```sql
-- If you filter by severity:
-- CREATE INDEX IF NOT EXISTS idx_infractions_severity
--   ON infractions(severity);

-- If you filter by state + date:
-- CREATE INDEX IF NOT EXISTS idx_expedients_state_date
--   ON expedients(state, created_at DESC);

-- If you have user_id column:
-- CREATE INDEX IF NOT EXISTS idx_expedients_user_id
--   ON expedients(user_id);

-- If you need user + state combo:
-- CREATE INDEX IF NOT EXISTS idx_expedients_user_state
--   ON expedients(user_id, state);
```

---

## 📋 EJECUCIÓN RECOMENDADA

### Paso 1: Descubre tu schema
Ejecuta el SQL en sección **1️⃣**. Copia el resultado de tablas.

### Paso 2: Índices básicos
Ejecuta el SQL en sección **2️⃣** (minimalista - siempre funciona)

### Paso 3: Verifica
Ejecuta el SQL en sección **5️⃣** para confirmar que funcionó

### Paso 4: (Opcional) RLS
Si tienes columna `created_by`, ejecuta sección **4️⃣**

### Paso 5: (Opcional) Más índices
Si usas ciertos filtros, descomenta en sección **7️⃣**

---

## 🎯 QUICK START

Si tienes prisa, ejecuta **SOLO ESTO**:

```sql
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);
CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);
CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);
ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
```

**Resultado:** 10-100x búsquedas más rápidas ⚡

---

## ⚙️ CONNECTION POOLING (Dashboard)

1. Supabase Dashboard → Project Settings
2. Database → Connection Pooling
3. Enable
4. Mode: **Transaction**
5. Pool Size: **25**
6. Max Overflow: **5**
7. Idle Timeout: **600**

---

## ❓ AYUDA

Si obtienes error:
1. Copia el SQL que fallò
2. Nota el error exacto
3. Ejecuta el SQL de **sección 6️⃣** (DIAGNOSTIC)
4. Pasa el resultado y arreglo el SQL

**¡Listo! 🚀**
