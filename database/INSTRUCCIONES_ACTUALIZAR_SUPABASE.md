# 🔧 Instrucciones: Actualizar SQL en Supabase

## ⚠️ IMPORTANTE

Tu aplicación está intentando guardar expedientes en Supabase, pero **la tabla `expedients` no existe** o le faltan columnas. 

He creado un archivo SQL completo con:
- ✅ Tabla `expedients` con TODOS los campos necesarios
- ✅ Tabla `infractions` para registrar infracciones detectadas
- ✅ Tabla `evidence` para guardar evidencia digital
- ✅ Índices para optimizar consultas
- ✅ Row Level Security (RLS) para proteger datos
- ✅ Triggers para actualizar timestamps
- ✅ Funciones útiles

---

## 📋 PASOS A SEGUIR

### **PASO 1: Acceder a Supabase**

1. Ve a https://app.supabase.com
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto "Sentinel AI"
4. En el menú izquierdo, ve a **SQL Editor**

### **PASO 2: Ejecutar el SQL**

1. Abre el archivo: `database/create-expedients-table.sql`
2. Copia TODO el contenido
3. En Supabase SQL Editor, pega el SQL completo
4. Haz clic en **"Execute"** (botón azul)

**Resultado esperado:** 
```
✓ CREATE TABLE expedients
✓ CREATE INDEX idx_expedients_state
✓ CREATE TABLE infractions
✓ CREATE TABLE evidence
✓ CREATE POLICY expedients_user_isolation
... (más operaciones)
```

---

## 🔍 VERIFICAR QUE FUNCIONÓ

### **Opción 1: Verificar tablas en Supabase**

1. En Supabase, ve a **Table Editor** (panel izquierdo)
2. Deberías ver:
   - ✅ `expedients` (la tabla principal)
   - ✅ `infractions` (tabla de infracciones)
   - ✅ `evidence` (tabla de evidencia)

### **Opción 2: Verificar con SQL**

Ejecuta estos comandos en SQL Editor para verificar:

```sql
-- Ver estructura de la tabla expedients
\d expedients

-- Ver índices creados
SELECT indexname FROM pg_indexes WHERE tablename = 'expedients';

-- Ver políticas de RLS
SELECT policyname FROM pg_policies WHERE tablename = 'expedients';

-- Verificar que la tabla está vacía
SELECT COUNT(*) FROM expedients;
```

---

## ⚙️ CONFIGURACIÓN RECOMENDADA EN SUPABASE

### **Paso 1: Habilitar RLS**

1. Ve a **Authentication** → **Policies**
2. Verifica que RLS esté habilitado para:
   - `expedients` ✓
   - `infractions` ✓
   - `evidence` ✓

### **Paso 2: Configurar Connection Pooling**

1. Ve a **Project Settings** → **Database**
2. En "Connection pooling" configura:
   - **Mode:** Transaction
   - **Pool Size:** 20-30
   - **Max Overflow:** 5
   - **Idle Timeout:** 600 segundos

### **Paso 3: Verificar Auth**

Tu aplicación necesita que el usuario esté autenticado. Verifica:

```sql
-- Ver usuarios
SELECT * FROM auth.users;

-- Verificar que el usuario actual tiene permisos
SELECT auth.uid();
```

---

## ❌ SI ALGO SALE MAL

### **Error: "Relation 'expedients' already exists"**

Significa que la tabla ya existe. Ejecuta esto para actualizar SOLO los nuevos campos:

```sql
-- Agregar campos que falten
ALTER TABLE expedients 
  ADD COLUMN IF NOT EXISTS titulo VARCHAR(255);

-- Crear índices que falten
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);
```

### **Error: "Permission denied"**

Significa que tu usuario de Supabase no tiene permisos. Soluciones:

1. **Verifica que iniciaste sesión** en Supabase con el usuario correcto
2. **Usa la contraseña del proyecto**, no tu contraseña de cuenta
3. **Ve a Settings → Database** → copia la contraseña de `postgres` y úsala en la conexión

### **Error: "Foreign key constraint violated"**

Significa que faltan tablas relacionadas. Asegúrate de ejecutar el SQL **COMPLETO**, no solo partes.

---

## 🚀 VERIFICAR QUE LA APP FUNCIONA

Después de actualizar el SQL:

1. **Reinicia la aplicación** (npm run dev)
2. **Carga un video** y detecta una infracción
3. **Crea un expediente** desde el módulo de infracciones
4. **Verifica en Supabase** que el expediente se guardó:

```sql
SELECT id, license_plate, violation_type, state, created_at
FROM expedients
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 CAMPOS QUE SE GUARDAN AUTOMÁTICAMENTE

Tu aplicación está configurada para guardar **65+ campos** en cada expediente:

### Identificación (4 campos)
- `id`, `infraction_id`, `created_at`, `updated_at`, `state`

### Caso (5 campos)
- `violation_type`, `location`, `timestamp`, `license_plate`, `vehicle_description`

### Lugar (8 campos)
- `via`, `numero_punto_kilometrico`, `municipio`, `provincia`, `latitud`, `longitud`, etc.

### Normativa (10 campos)
- `gravedad`, `articulo_conducta`, `articulo_sancionador`, etc.

### Sanción (3 campos)
- `sancion_euros`, `puntos_detraccion`, `riesgo_nivel`

### Vehículo (6 campos)
- `marca`, `modelo`, `color`, `numero_chasis`, `estado_itv`, `seguro_obligatorio`

### Titular (7 campos)
- `titular_nombre`, `titular_dni`, `titular_domicilio`, `titular_localidad`, `titular_provincia`, `titular_telefono`, `titular_email`

### Conductor (9 campos)
- `conductor_nombre`, `conductor_dni`, `conductor_permiso`, `conductor_clase`, `conductor_domicilio`, `conductor_localidad`, `conductor_provincia`, `conductor_telefono`, `conductor_email`

### Evidencia (3 campos)
- `evidence_id`, `photos_count`, `video_clip_hash`

### Firma y Auditoría (8 campos)
- `operator`, `supervisor`, `signature_is_signed`, `signature_signed_by`, `signature_hash`, `state_history`, `audit_log`, etc.

---

## 🔐 SEGURIDAD Y ROW LEVEL SECURITY

El SQL incluye políticas de seguridad:

✅ **Users can only see their own expedients**
```sql
-- Solo ven expedientes que crearon o en los que trabajan
WHERE auth.uid() = created_by OR auth.uid() = operator_id
```

✅ **Users can only insert their own expedients**
```sql
-- Solo pueden crear si se establecen como created_by
WHERE auth.uid() = created_by
```

---

## 📞 SOPORTE

Si tienes problemas:

1. **Verifica que el SQL se ejecutó sin errores** (busca "✓" en rojo)
2. **Comprueba en Table Editor** que la tabla existe
3. **Ejecuta un SELECT** simple para ver si hay datos:
   ```sql
   SELECT COUNT(*) FROM expedients;
   ```
4. **Revisa los logs de la app** (npm run dev) para ver mensajes de error

---

## ✅ CHECKLIST FINAL

- [ ] SQL ejecutado en Supabase sin errores
- [ ] Tabla `expedients` visible en Table Editor
- [ ] RLS habilitado para `expedients`
- [ ] Connection pooling configurado
- [ ] Aplicación reiniciada (npm run dev)
- [ ] Creé un expediente de prueba
- [ ] Aparece en Supabase (SELECT FROM expedients)
- [ ] Todos los campos se guardaron correctamente
