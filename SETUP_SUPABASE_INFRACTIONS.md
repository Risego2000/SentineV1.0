# 🔧 Configurar Infracciones en Supabase

El componente `InfractionsTable` necesita acceso a datos en Supabase. Aquí están las soluciones por orden de facilidad:

---

## ✅ **Solución 1: Crear Datos de Prueba (Recomendado)**

### Paso 1: Abre el SQL Editor de Supabase
1. Ve a https://supabase.com/dashboard/project/iyikrnmyxytlnmuvscwj/sql
2. Haz clic en "New Query"

### Paso 2: Ejecuta este SQL para crear las tablas

```sql
-- Crear tabla infractions
CREATE TABLE IF NOT EXISTS public.infractions (
  id BIGSERIAL PRIMARY KEY,
  plate TEXT,
  make_model TEXT,
  color TEXT,
  description TEXT,
  severity TEXT,
  rule_category TEXT,
  legal_base TEXT,
  status TEXT,
  time TIMESTAMP,
  local_time TEXT,
  video_time_code TEXT,
  fine_amount INTEGER,
  points_deducted INTEGER,
  validation_status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla expedients
CREATE TABLE IF NOT EXISTS public.expedients (
  id BIGSERIAL PRIMARY KEY,
  infraction_id BIGINT REFERENCES public.infractions(id),
  custody_last_checked_at TIMESTAMP,
  custody_last_status TEXT,
  custody_last_summary TEXT,
  custody_verification_rows JSONB,
  audit_log JSONB,
  state_history JSONB,
  validation JSONB,
  operator TEXT,
  supervisor TEXT,
  signature_is_signed BOOLEAN,
  signature_signed_by TEXT,
  signature_hash TEXT,
  dpia_certified BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_infractions_plate ON public.infractions(plate);
CREATE INDEX IF NOT EXISTS idx_infractions_created ON public.infractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedients_infraction ON public.expedients(infraction_id);
CREATE INDEX IF NOT EXISTS idx_expedients_created ON public.expedients(created_at DESC);
```

### Paso 3: Inserta datos de prueba

```sql
-- Insertar infracciones de prueba
INSERT INTO public.infractions 
  (plate, make_model, color, description, severity, rule_category, legal_base, status, time, local_time, video_time_code, fine_amount, points_deducted, validation_status)
VALUES
  ('ABC1234', 'Audi A4', 'Negro', 'Cruzó línea de semáforo en rojo', 'HIGH', 'SEMAFORO_ROJO', 'Art. 67 LTSV', 'DETECTED', NOW() - INTERVAL '1 hour', (NOW() - INTERVAL '1 hour')::TEXT, '14:32:15.123', 200, 3, 'PENDING'),
  ('XYZ9876', 'BMW M3', 'Blanco', 'Exceso de velocidad en zona de 50 km/h', 'MEDIUM', 'SPEED_VIOLATION', 'Art. 47 LTSV', 'DETECTED', NOW() - INTERVAL '2 hours', (NOW() - INTERVAL '2 hours')::TEXT, '12:15:30.456', 100, 2, 'PENDING'),
  ('DEF5678', 'Mercedes C200', 'Gris', 'No respetó señal de STOP', 'HIGH', 'STOP_NO_DETENCION', 'Art. 60 LTSV', 'DETECTED', NOW() - INTERVAL '3 hours', (NOW() - INTERVAL '3 hours')::TEXT, '10:45:22.789', 300, 4, 'VALIDATED');

-- Insertar datos de custodia y auditoría
INSERT INTO public.expedients 
  (infraction_id, custody_last_checked_at, custody_last_status, custody_last_summary, custody_verification_rows, audit_log, state_history, validation, operator, supervisor, signature_is_signed, signature_signed_by, signature_hash, dpia_certified)
VALUES
  (
    (SELECT id FROM public.infractions WHERE plate = 'ABC1234' LIMIT 1),
    NOW() - INTERVAL '30 minutes',
    'SUCCESS',
    '3/3 archivos verificados correctamente',
    '[
      {
        "fileName": "video_original.mp4",
        "kind": "ORIGINAL",
        "expectedHash": "a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
        "calculatedHash": "a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
        "isValid": true,
        "checkedAt": "'||(NOW() - INTERVAL '30 minutes')::TEXT||'"
      },
      {
        "fileName": "infraction_clip_8s.mp4",
        "kind": "PROCESADA",
        "expectedHash": "b4g5c3d0e9f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6",
        "calculatedHash": "b4g5c3d0e9f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6",
        "isValid": true,
        "checkedAt": "'||(NOW() - INTERVAL '30 minutes')::TEXT||'"
      },
      {
        "fileName": "report_signed.pdf",
        "kind": "REPORTE",
        "expectedHash": "c5h6d4e1f0g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7",
        "calculatedHash": "c5h6d4e1f0g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7",
        "isValid": true,
        "checkedAt": "'||(NOW() - INTERVAL '30 minutes')::TEXT||'"
      }
    ]'::JSONB,
    '[
      {"timestamp": "'||(NOW() - INTERVAL '1 hour')::TEXT||'", "action": "EVIDENCE_CREATED", "actor": "sistema"},
      {"timestamp": "'||(NOW() - INTERVAL '50 minutes')::TEXT||'", "action": "REPORT_GENERATED", "actor": "juan_lopez"},
      {"timestamp": "'||(NOW() - INTERVAL '40 minutes')::TEXT||'", "action": "REPORT_VALIDATED", "actor": "juan_lopez"},
      {"timestamp": "'||(NOW() - INTERVAL '30 minutes')::TEXT||'", "action": "REPORT_SIGNED", "actor": "admin"}
    ]'::JSONB,
    '[
      {"from": "DETECTED", "to": "UNDER_REVIEW", "actor": "juan_lopez", "timestamp": '||(NOW() - INTERVAL '50 minutes')::BIGINT||'},
      {"from": "UNDER_REVIEW", "to": "VALIDATED", "actor": "juan_lopez", "timestamp": '||(NOW() - INTERVAL '40 minutes')::BIGINT||'},
      {"from": "VALIDATED", "to": "SIGNED", "actor": "admin", "timestamp": '||(NOW() - INTERVAL '30 minutes')::BIGINT||'}
    ]'::JSONB,
    '{
      "isValid": true,
      "validatedBy": "juan_lopez",
      "validatedAt": '||(NOW() - INTERVAL '40 minutes')::BIGINT||',
      "evidenceVerified": true,
      "plateVerified": true,
      "speedVerified": true
    }'::JSONB,
    'juan_lopez@policia.es',
    'admin@policia.es',
    true,
    'Digital - 2026-05-04 15:00:00',
    'a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    true
  );
```

### Paso 4: Configura RLS (Row Level Security)

```sql
-- Habilitar RLS en las tablas
ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

-- Crear políticas de lectura pública
CREATE POLICY "Allow public read infractions" ON public.infractions 
  FOR SELECT USING (true);

CREATE POLICY "Allow public read expedients" ON public.expedients 
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert infractions" ON public.infractions 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update infractions" ON public.infractions 
  FOR UPDATE USING (auth.role() = 'authenticated');
```

### Paso 5: Recarga la aplicación
1. En la app, ve a Expedientes (Ctrl+E)
2. No selecciones ningún expediente en la lista izquierda
3. La tabla de infracciones debería aparecer con los datos de prueba ✅

---

## ❌ **Solución 2: Si ya tienes tabla "infractions"**

Si ya tienes la tabla pero no aparecen datos, el problema es probablemente **RLS**:

1. Ve a https://supabase.com/dashboard/project/iyikrnmyxytlnmuvscwj/auth/policies
2. Selecciona tabla `infractions`
3. Asegúrate de que existe una política **SELECT** con:
   - **Target roles**: `anon` (o `public`)
   - **USING** (WITH CHECK): `true`

Si no existe, crea una nueva:
```
CREATE POLICY "Allow public read" ON public.infractions 
  FOR SELECT USING (true);
```

---

## ❌ **Solución 3: Si tienes tabla "incidents" (fallback)**

Si usas una tabla diferente llamada `incidents`, asegúrate que tenga los mismos campos:
- plate, make_model, color, description, severity, rule_category, legal_base
- status, time, local_time, video_time_code, fine_amount, points_deducted
- validation_status, created_at

---

## 🔍 **Verificar que funcionó**

1. Abre DevTools (F12) en el navegador
2. Ve a tab "Network" o "Console"
3. Busca requests a `infractions` o `incidents`
4. Si ves **200 OK**: ¡Datos cargados! ✅
5. Si ves **403 Forbidden**: Problema de RLS
6. Si ves **404 Not Found**: Tabla no existe

---

## 📞 **Si seguís con errores**

Verifica en Supabase Dashboard:

1. **Tablas creadas**: https://supabase.com/dashboard/project/iyikrnmyxytlnmuvscwj/editor
   - ¿Existen `infractions` y `expedients`?

2. **Datos insertados**: Abre tabla > "Data" tab
   - ¿Hay filas?

3. **RLS Habilitado**: Auth > Policies
   - ¿Hay políticas SELECT?

4. **API Conectada**: API > REST API
   - ¿Puedes hacer requests?

---

## 🎯 **Resultado Esperado**

Una vez configurado, deberías ver:

```
INFRACCIONES DETECTADAS
3 registros • Última actualización: 14:32:15

┌─────────┬────────────┬──────────────────┬──────────┬──────────┬────────────┬────────┐
│ Placa   │ Vehículo   │ Infracción       │ Gravedad │ Hora     │ Validación │ Multa  │
├─────────┼────────────┼──────────────────┼──────────┼──────────┼────────────┼────────┤
│ ABC1234 │ Audi A4    │ SEMAFORO_ROJO    │ HIGH     │ 14:32:15 │ PENDING    │ 200€   │
│ XYZ9876 │ BMW M3     │ SPEED_VIOLATION  │ MEDIUM   │ 12:15:30 │ PENDING    │ 100€   │
│ DEF5678 │ Mercedes   │ STOP_NO_DETENCION│ HIGH     │ 10:45:22 │ VALIDATED  │ 300€   │
└─────────┴────────────┴──────────────────┴──────────┴──────────┴────────────┴────────┘
```

Click en "⋯" para ver todos los datos de custodia, auditoría y validación.

---

**Fecha**: 2026-05-04  
**Tabla**: infractions + expedients  
**Componente**: `components/InfractionsTable.tsx`
