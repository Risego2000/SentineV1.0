# 🚀 Inicio Rápido - TIER 1

**Tiempo total**: 15 minutos para tener todo funcional

---

## 1️⃣ Configurar Variables de Entorno (2 min)

Crear archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Dónde obtener:**
1. Ir a https://supabase.com
2. Crear proyecto o usar existente
3. Configuración → API → Copiar URL y anon key
4. Pegar en .env.local

---

## 2️⃣ Crear Tabla en Supabase (3 min)

En Supabase, ir a Editor SQL y ejecutar:

```sql
CREATE TABLE IF NOT EXISTS public.expedients (
    id text PRIMARY KEY,
    infraction_id text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    state varchar NOT NULL,
    violation_type varchar NOT NULL,
    location text NOT NULL,
    timestamp timestamp with time zone NOT NULL,
    license_plate varchar NOT NULL,
    vehicle_description text,
    evidence_id text,
    photos_count integer,
    video_clip_hash text,
    operator varchar,
    supervisor varchar,
    signature_is_signed boolean DEFAULT false,
    signature_signed_by varchar,
    signature_signed_at bigint,
    signature_hash text,
    signature_cert_fingerprint text,
    state_history jsonb DEFAULT '[]'::jsonb,
    audit_log jsonb DEFAULT '[]'::jsonb,
    dpia_certified boolean DEFAULT false,
    data_retention_days integer DEFAULT 365
);

CREATE INDEX idx_expedients_state ON public.expedients(state);
CREATE INDEX idx_expedients_license_plate ON public.expedients(license_plate);

ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todos" ON public.expedients FOR ALL USING (true);
```

---

## 3️⃣ Instalar Dependencias (1 min)

```bash
npm install @supabase/supabase-js
```

---

## 4️⃣ Iniciar Aplicación (2 min)

```bash
npm run dev
```

Debe ver:
- App abre normalmente
- Botones "🎥 Detección" y "📋 Expedientes" en la parte superior
- Puedo cambiar entre vistas

---

## 5️⃣ Pruebas Rápidas (7 min)

### Prueba 1: Vista de Expedientes
```
1. Hacer clic en "📋 Expedientes"
2. Ver "No hay expedientes pendientes"
3. ✅ ÉXITO si se carga sin errores
```

### Prueba 2: Crear Expediente (desde consola JS)
```javascript
// En Herramientas de Desarrollador (F12) → Consola:
const { getExpedientService } = await import('./services/ExpedientService.ts');
const svc = getExpedientService();
await svc.createExpedient({
  infractionId: 'PRUEBA-001',
  violationType: 'STOP',
  location: 'Calle Principal 123',
  timestamp: Date.now(),
  evidenceId: 'EV-PRUEBA',
  licensePlate: 'ABCD-123',
});
```

### Prueba 3: Recargar y Ver
```
1. Recargar página (F5)
2. Ir a "📋 Expedientes"
3. Debe aparecer el expediente
4. Hacer clic en él
5. Ver detalles en panel derecho
6. ✅ ÉXITO si aparece y muestra datos
```

### Prueba 4: Transición
```
1. En el expediente, hacer clic "Iniciar Revisión"
2. Ver que el estado cambia a "Bajo revisión"
3. Aparecen botones "Validar" y "Rechazar"
4. ✅ ÉXITO si funciona sin errores
```

### Prueba 5: Firma y PDF
```
1. Hacer clic en "Validar"
2. Estado → "Validada"
3. (En Herramientas Dev: sessionStorage.setItem('currentUserRole', 'SUPERVISOR'))
4. Hacer clic en "Firmar Digitalmente"
5. Estado → "Firmada"
6. Hacer clic en "📥 Descargar PDF (OFICIAL)"
7. Se descarga PDF
8. ✅ ÉXITO si PDF se genera sin errores
```

---

## ✅ Si Todo Funciona

**¡Enhorabuena!** TIER 1 está operativo.

Ahora puedes:
- ✅ Ver expedientes pendientes
- ✅ Transicionar estados
- ✅ Firmar digitalmente
- ✅ Descargar PDFs

---

## ❌ Si Algo Falla

### Error: "No se puede encontrar módulo '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js
npm run dev
```

### Error: "supabaseUrl no está definido"
- Verificar que .env.local existe en raíz
- Verificar que las variables son correctas
- Reiniciar aplicación

### Error: "tabla expedients no encontrada"
- Verificar SQL ejecutado en Supabase
- Verificar que tabla aparece en interfaz de Supabase
- Verificar no hay errores tipográficos en nombre de tabla

### Los expedientes no se cargan
- Abrir Herramientas Dev → pestaña Red
- Ver si solicitud a Supabase falla
- Verificar que RLS policies están correctas
- Ejecutar: `await supabase.from('expedients').select('*')`

### PDF no se descarga
- Verificar consola para errores
- Verificar que signature.isSigned = true
- Verificar que PDFExportService.generatePDF() no retorna null

---

## 📱 Navegación Rápida

| Acción | Cómo |
|--------|------|
| Cambiar vista | Clic en botón O Ctrl+E |
| Crear expediente | Desde consola (ver Prueba 2) |
| Ver expedientes | 📋 Expedientes |
| Seleccionar uno | Clic en la lista |
| Ver detalles | Panel derecho muestra ExpedientWorkflow |
| Validar | Clic en "Validar" |
| Rechazar | Clic en "Rechazar" + motivo |
| Firmar | Clic en "Firmar Digitalmente" (SUPERVISOR) |
| Descargar PDF | Clic en "📥 Descargar PDF" |

---

## 🎯 Flujo Completo (5 min)

```
Crear → Ver en Lista → Seleccionar → Validar → Firmar → Descargar PDF
```

**Ejemplo práctico:**
```
1. Ejecutar código de Prueba 2 en consola
2. Recargar página
3. Hacer clic en "📋 Expedientes"
4. Hacer clic en el expediente
5. Clic "Iniciar Revisión"
6. Clic "Validar"
7. Cambiar rol en Herramientas Dev: sessionStorage.setItem('currentUserRole', 'SUPERVISOR')
8. Clic "Firmar Digitalmente"
9. Clic "📥 Descargar PDF"
10. Ver PDF descargado
```

---

## 📚 Documentación Detallada

Para información más profunda, ver:
- **INTEGRACION_TIER1.md** - Detalles técnicos
- **LISTA_VERIFICACION_TIER1.md** - Verificación completa
- **RESUMEN_TIER1.md** - Resumen ejecutivo

---

## 🆘 Soporte

Si necesitas ayuda:
1. Revisar consola (F12)
2. Verificar pestaña Red
3. Leer LISTA_VERIFICACION_TIER1.md sección "Errores Comunes"
4. Ejecutar pruebas nuevamente

---

**Estado**: ✅ Listo para usar

**Tiempo estimado de configuración**: 15 minutos
