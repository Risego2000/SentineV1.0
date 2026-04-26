# ✅ TIER 1 - Lista de Verificación

**Objetivo**: Validar que todas las piezas de TIER 1 estén correctamente integradas.

---

## 📦 Archivos Creados/Modificados

### ✅ Archivos Nuevos Creados

- [x] `utils/supabaseClient.ts` (56 líneas)
  - Inicializa cliente Supabase con credenciales de .env.local
  - Exporta funciones de conexión y sesión

- [x] `services/ExpedientRepository.ts` (278 líneas)
  - Operaciones CRUD para expedientes
  - Mapeo de modelo Supabase ↔ TypeScript
  - Patrón Singleton

- [x] `components/ExpedientWorkflow.tsx` (500 líneas)
  - Componente de interfaz con estado y transiciones
  - Modal de rechazo con validación
  - Estilos inline completos

- [x] `pages/ExpedientListPage.tsx` (550+ líneas)
  - Lista de expedientes pendientes
  - Panel lateral de detalles
  - Botón de descarga PDF integrado

- [x] `App.tsx` (actualizado - cambio de vista)
  - Cambio entre "🎥 Detección" y "📋 Expedientes"
  - Atajo Ctrl+E para cambiar vista
  - Preserva estructura de diseño original

### ✅ Archivos Actualizados

- [x] `services/ExpedientService.ts` (actualizado)
  - Reemplazó Mapa en memoria con ExpedientRepository
  - Todos los métodos ahora son asincronos
  - Métodos getExpedient y de utilidad ahora son async
  - Agregó método getAllExpedients()

---

## 🔧 Configuración Requerida

### 1. Archivo .env.local

Crear en raíz del proyecto:

```bash
# Configuración de Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Usuario Actual (OPCIONAL - se puede configurar en la interfaz)
VITE_CURRENT_USER_NAME=Tu Nombre
VITE_CURRENT_USER_ROLE=OPERATOR
```

**Dónde obtener las credenciales:**
1. Ir a https://supabase.com y crear un proyecto
2. Configuración → API → URL del proyecto y clave anon
3. Copiar y pegar en .env.local

### 2. Supabase - SQL de esquema

Ejecutar en Editor SQL de Supabase:

```sql
-- Crear tabla expedients
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

-- Crear índices para consultas comunes
CREATE INDEX idx_expedients_state ON public.expedients(state);
CREATE INDEX idx_expedients_license_plate ON public.expedients(license_plate);
CREATE INDEX idx_expedients_created_at ON public.expedients(created_at DESC);

-- Habilitar seguridad a nivel de fila
ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden operar (para desarrollo)
-- En producción, usar políticas más restrictivas
CREATE POLICY "Permitir todas las operaciones en expedientes por ahora"
ON public.expedients
FOR ALL
USING (true);
```

### 3. Importaciones Verificadas

Las siguientes importaciones deben estar disponibles:

```typescript
// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// ExpedientService.ts
import {
  ExpedientRepository,
  initializeExpedientRepository,
  getExpedientRepository,
} from './ExpedientRepository';
import { supabase } from '../utils/supabaseClient';

// App.tsx
import { ExpedientListPage } from './pages/ExpedientListPage';

// ExpedientListPage.tsx
import { ExpedientWorkflow } from '../components/ExpedientWorkflow';
import { PDFExportService } from '../services/PDFExportService';
```

---

## 🧪 Verificación de Compilación

Ejecutar estos comandos:

```bash
# Instalar dependencias (si falta @supabase/supabase-js)
npm install @supabase/supabase-js

# Verificar TypeScript
npm run type-check
# O si no existe, intentar: npx tsc --noEmit

# Compilar para desarrollo
npm run dev

# Verificar si hay errores en la consola
# Debe haber un mensaje de "Puerto de backend desde Electron" o similar
```

**Errores Esperados a Manejar:**
- ⚠️ Si falta @supabase/supabase-js: `npm install @supabase/supabase-js`
- ⚠️ Si falta .env.local: Aplicación funcionará pero sin persistencia
- ⚠️ Si Supabase no está configurado: Verá errores de conexión en consola

---

## 🎯 Prueba Manual - Paso a Paso

### Prueba 1: Iniciar Aplicación
```
1. npm run dev
2. Aplicación debe abrirse
3. Ver botones "🎥 Detección" y "📋 Expedientes"
4. Estar en vista de detección por defecto
```

### Prueba 2: Cambiar a Vista de Expedientes
```
1. Hacer clic en "📋 Expedientes"
2. O presionar Ctrl+E
3. Debe cambiar a ExpedientListPage
4. Ver texto "No hay expedientes pendientes"
```

### Prueba 3: Crear Expediente (desde código)
```javascript
// En consola, ejecutar:
const svc = window.__expedientService; // Exponer en App.tsx
await svc.createExpedient({
  infractionId: 'PRUEBA-001',
  violationType: 'STOP',
  location: 'Calle de Prueba 123',
  timestamp: Date.now(),
  evidenceId: 'EV-PRUEBA',
  licensePlate: 'ABCD-123',
});
```

### Prueba 4: Recargar y Ver Expediente
```
1. Recargar página (F5)
2. Ir a "📋 Expedientes"
3. Debe aparecer el expediente creado
4. Hacer clic en él
5. Ver ExpedientWorkflow con botón "Iniciar Revisión"
```

### Prueba 5: Transiciones de Estado
```
1. Hacer clic en "Iniciar Revisión"
2. Estado debe cambiar a "Bajo revisión"
3. Ver botones "Validar" y "Rechazar"
4. Hacer clic en "Validar"
5. Estado debe cambiar a "Validada"
6. Ver botón "Firmar Digitalmente"
```

### Prueba 6: Firma Digital
```
1. Cambiar rol a SUPERVISOR
   - sessionStorage.setItem('currentUserRole', 'SUPERVISOR')
2. Hacer clic en "Firmar Digitalmente"
3. Estado debe cambiar a "Firmada"
4. Ver botón "Exportar Reporte Oficial"
```

### Prueba 7: Exportar PDF
```
1. Hacer clic en "📥 Descargar PDF (OFICIAL)"
2. PDF debe descargarse como Expediente_{id}_{date}.pdf
3. Abrir PDF y verificar:
   - Título: "EXPEDIENTE DE INFRACCIÓN"
   - Watermark: "OFICIAL"
   - Información: Placa, tipo, ubicación, fecha
   - Firma: Hash SHA-256
```

---

## 📊 Matriz de Dependencias

```
App.tsx
├── ExpedientListPage.tsx
│   ├── ExpedientWorkflow.tsx
│   │   ├── ExpedientStateMachine ✅
│   │   └── logger ✅
│   ├── PDFExportService.ts
│   │   ├── SignatureService ✅
│   │   └── logger ✅
│   ├── ExpedientService.ts
│   │   ├── ExpedientRepository.ts
│   │   │   └── supabaseClient.ts ✅
│   │   ├── ExpedientStateMachine ✅
│   │   ├── SignatureService ✅
│   │   └── logger ✅
│   └── sessionStorage (información del usuario)
└── MultiViewerGrid (existente)
```

---

## 🔍 Puntos Críticos a Verificar

### ✅ Supabase Conectado
```typescript
// En consola del navegador:
const { supabase } = await import('./utils/supabaseClient.ts');
await supabase.from('expedients').select('count()', { count: 'exact' });
// Debe devolver {count: 0} o número de expedientes
```

### ✅ Expediente Persistido
```typescript
// Crear expediente
const svc = getExpedientService();
const exp = await svc.createExpedient({...});

// Verificar en Supabase
// Ir a https://app.supabase.com → tabla expedients
// Debe ver la fila insertada
```

### ✅ PDF Generado
```typescript
// Generar PDF
const pdf = await PDFExportService.generatePDF(expedient);
// Debe devolver Buffer (no null)
```

---

## 🚨 Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| "No se puede encontrar módulo '@supabase/supabase-js'" | Falta instalación | `npm install @supabase/supabase-js` |
| "supabaseUrl no está definido" | .env.local vacío | Agregar VITE_SUPABASE_URL y KEY |
| "Expediente no encontrado" | No se guardó en BD | Verificar políticas RLS en Supabase |
| "PDF es null" | Firma inválida | Verificar signature.isSigned = true |
| "Componente React no encontrado" | Ruta de importación incorrecta | Verificar rutas relativas ../ |
| "Cambio de vista no funciona" | Ctrl+E no implementado | Verificar listener en App.tsx |

---

## 📈 Métricas de Éxito

- [ ] Aplicación compila sin errores TypeScript
- [ ] Vista de detección funciona (🎥)
- [ ] Vista de expedientes funciona (📋)
- [ ] Ctrl+E cambia vistas
- [ ] Se puede crear expediente
- [ ] Se ve en la lista
- [ ] Se puede transicionar estado
- [ ] Se puede firmar (como SUPERVISOR)
- [ ] PDF se genera y descarga
- [ ] Supabase almacena datos
- [ ] Recarga de página preserva datos
- [ ] No hay errores en consola

---

## 🎓 Próximos Pasos

Una vez TIER 1 esté completo:

### TIER 2: Integración con Video (opcional)
- Conectar detector COCO-SSD
- Crear expedientes automáticamente
- Mostrar evidencia en WorkflowComponent

### TIER 3: Panel de Control (opcional)
- Gráficos de estadísticas
- Búsqueda avanzada
- Reportes por período

### TIER 4: Producción (opcional)
- Construcción Electron
- Actualización automática
- Supervisión

---

**Última Actualización**: 2026-04-25  
**Estado**: ✅ Listo para Prueba
