# Guía de Testing SentinelV16

## Descripción General

Esta guía proporciona procedimientos de testing exhaustivos para todas las características de SentinelV16 implementadas en las Fases 1-4 y Fase 3.1.

---

## Configuración del Entorno de Testing

### Requisitos Previos
- Node.js 16+ con soporte TypeScript
- FFmpeg con aceleración GPU (AMD/NVIDIA/Intel)
- Clave API de Google Gemini
- Archivos de video de prueba en varios códecs

### Configuración
Crear `.env.local` para testing:
```bash
PORT=3002
GEMINI_API_KEY=<tu-clave-api>
SENTINEL_API_TOKEN=test_token_1234567890123456
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
NODE_ENV=test
```

---

## Fase 1: Testing de Seguridad y Estabilidad

### 1.1 Testing de Validación de Entrada

#### Casos de Prueba
```bash
# Solicitud de geometría válida
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "directives": "Detectar líneas prohibidas en vías principales",
    "instruction": "Enfocarse en carriles"
  }'

# Esperado: 200 OK con respuesta de geometría

# Directiva requerida faltante
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{"image": "base64data"}'

# Esperado: 400 Bad Request - "Las directivas deben ser texto."

# Imagen excede límite de tamaño (>5MB base64)
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "directives": "Test",
    "image": "<cadena base64 de 6MB+>"
  }'

# Esperado: 413 Payload Too Large
```

### 1.2 Testing de Autenticación

#### Token Válido
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer test_token_1234567890123456"

# Esperado: 200 OK con estado de salud
```

#### Token Inválido
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer token_invalido"

# Esperado: 401 Unauthorized
```

#### Token Faltante
```bash
curl -X GET http://localhost:3002/api/health

# Esperado: 401 Unauthorized
```

### 1.3 Testing de Manejo de Errores

#### Errores de Servicio de IA
```bash
# Estructura de solicitud válida pero servicio de IA retorna error
# Monitorear logs para:
# - "[GEMINI] Parse error"
# - "[GEMINI] generateGeometry error"
# - Respuesta de fallback con campo error

# Esperado: 200 OK con información de error
{
  "lines": [],
  "suggestedDirectives": "Error en generación automática...",
  "error": "JSON parsing error..."
}
```

#### Registro de Auditoría
```bash
# Verificar logs del servidor para entradas de auditoría
tail -f server.log | grep "API_AUDIT"

# Salida esperada:
# [TIMESTAMP] [INFO] [API_AUDIT] POST /api/ai/geometry [200]
```

---

## Fase 2: Testing de Persistencia y Resiliencia

### 2.1 Testing de Persistencia de Cola

#### Prueba de Configuración
```javascript
// Limpiar IndexedDB
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase('sentinel_forensic_queue');
  request.onsuccess = () => resolve();
  request.onerror = () => reject();
});
```

#### Prueba de Persistencia de Cola
```javascript
// 1. Encolar trabajos forenses
const queue = new ForensicQueueV3();
queue.enqueue(trackData, geometryData, evidenceId, localTime, videoTimeCode, playbackTime);

// 2. Verificar almacenamiento en IndexedDB
const persistence = new ForensicQueuePersistence();
const items = await persistence.loadQueueItems();
console.assert(items.length > 0, "Elementos de cola persistidos");

// 3. Actualizar navegador
location.reload();

// 4. Verificar cola restaurada
const stats = queue.getQueueStats();
console.assert(stats.totalJobs > 0, "Cola restaurada después de actualizar");
```

### 2.2 Testing de Reintento Exponencial

#### Simular Fallo y Reintento
```javascript
// Monitorear demoras de reintento en logs
// Patrón esperado:
// [1er intento] Trabajo encolado
// [Error] Tiempo de espera IA - reintentando en 500ms (intento 1/5)
// [Reintento] Reintentando en 1000ms (intento 2/5)
// [Reintento] Reintentando en 2000ms (intento 3/5)
// [Reintento] Reintentando en 4000ms (intento 4/5)
// [Reintento] Reintentando en 8000ms (intento 5/5)
// [Fallido] Revisión manual creada después de 5 reintentos

const backoffDelay = (retries) => 500 * Math.pow(2, retries - 1);
// Verificar: backoffDelay(1) = 500, backoffDelay(5) = 8000
```

### 2.3 Testing de Auditoría de Fallback

#### Desencadenar Fallo Permanente
```javascript
// Simular fallo de API después de reintentos máximos
// Comportamiento esperado:
// 1. Trabajo marcado como fallido
// 2. Registro de auditoría de fallback creado con:
//    - infraction: false
//    - severity: "CRITICAL"
//    - ruleCategory: "MANUAL_REVIEW"
//    - description: "Análisis automático falló. Requiere revisión manual..."
// 3. Evidencia preservada en log de fallback
// 4. Registrado para revisión del operador
```

---

## Fase 3: Testing de Rendimiento y H.265

### 3.1 Testing de Detección H.265

#### Prueba de Detección de Carga H.265
```javascript
// Prueba de detección de archivo
const h265File = new File(
  [h265VideoBlob],
  'video.h265',
  { type: 'video/mp4' }
);

const codec = await detectVideoCodec(h265File);
console.assert(codec === 'hevc', "H.265 detectado correctamente");
```

#### Prueba de Diálogo de Advertencia H.265
```javascript
// 1. Cargar archivo H.265 vía UI
// Esperado: Aparece diálogo de advertencia
// - "Vídeo H.265 Detectado"
// - Opciones: Cancelar o "Subir de Todas Formas"

// 2. Hacer clic en "Cancelar"
// Esperado: Carga abortada

// 3. Cargar nuevamente, hacer clic en "Subir de Todas Formas"
// Esperado: Carga procede, servidor transcodifica a H.264
```

### 3.2 Testing de Aceleración GPU

#### Verificar Detección de GPU
```bash
node -e "
const { execSync } = require('child_process');
const ffmpegHelp = execSync('ffmpeg -encoders 2>&1').toString();
const hasGPU = ffmpegHelp.includes('h264_amf') || 
               ffmpegHelp.includes('h264_nvenc') || 
               ffmpegHelp.includes('h264_qsv') ||
               ffmpegHelp.includes('h264_videotoolbox');
console.log('GPU Disponible:', hasGPU);
"

# Salida esperada: GPU Disponible: true
```

#### Transcodificación de Benchmark
```bash
# Medir tiempo de transcodificación
time ffmpeg -i input.h265 -c:v h264_amf -usage transcoding output.mp4

# Esperado: <5 minutos para 1 hora de video con GPU
```

### 3.3 Testing de Optimización de Lienzo y RAF

#### Testing de Grupo de Lienzo
```javascript
import { getCanvasPool } from './services/canvasPool';

const pool = getCanvasPool();

// Adquirir lienzo
const { canvas, context, release } = pool.acquire(1920, 1080);

// Usar lienzo...
context.drawImage(video, 0, 0, 1920, 1080);

// Liberar de vuelta al grupo
release();

// Verificar estadísticas
const stats = pool.getStats();
console.log('Tamaño de Grupo:', stats.poolSize);        // Debe ser ≤ maxPoolSize
console.log('Tasa de Acierto de Caché:', stats.cacheHitRate); // Debe ser > 50% después del calentamiento
console.log('En Uso:', stats.inUse);               // Debe disminuir después de liberaciones
```

#### Testing del Planificador RAF
```javascript
import { getRAFScheduler, scheduleFrame } from './services/rafScheduler';

const scheduler = getRAFScheduler();
let frameCount = 0;

// Programar tarea de fotograma
const unschedule = scheduleFrame('test-task', (deltaTime) => {
  frameCount++;
  console.log(`Fotograma ${frameCount}, deltaTime: ${deltaTime.toFixed(2)}ms`);
});

// Después de 1 segundo, verificar métricas
setTimeout(() => {
  unschedule();
  const stats = scheduler.getStats();
  console.log('Velocidad de Fotograma:', stats.frameRate);     // Debe ser ~60 FPS
  console.log('Tiempo de Ejecución de Tarea:', stats.lastTaskExecutionTime); // Debe ser <16.67ms
}, 1000);
```

---

## Fase 4: Testing de Arquitectura y Seguridad de Tipos

### 4.1 Testing de Configuración

#### Probar appConfig
```javascript
import { AppConfig, QueueConfig } from './services/appConfig';

// Verificar valores de configuración
console.assert(QueueConfig.MAX_RETRIES === 5, 'Config de reintento');
console.assert(AppConfig.Validation.MAX_IMAGE_SIZE_MB === 5, 'Límite de tamaño de imagen');
console.assert(AppConfig.Features.ENABLE_QUEUE_PERSISTENCE === true, 'Características habilitadas');
```

### 4.2 Testing de Validación de DTO

#### Solicitud Válida
```javascript
import { AIGeometryRequestValidator } from './services/dtoValidation';

const validData = {
  directives: "Directivas de prueba",
  instruction: "Instrucción de prueba",
  image: "cadena base64"
};

const result = AIGeometryRequestValidator.validate(validData);
console.assert(result.valid === true, "DTO válido pasa");
console.assert(result.value.directives === "Directivas de prueba", "Valores extraídos");
```

#### Solicitud Inválida
```javascript
const invalidData = {
  directives: "", // Cadena vacía
  image: "x".repeat(6 * 1024 * 1024) // 6MB+
};

const result = AIGeometryRequestValidator.validate(invalidData);
console.assert(result.valid === false, "DTO inválido falla");
console.assert(result.path === "$.directives", "Ruta de error especificada");
```

### 4.3 Testing de Validación de Entorno

#### Entorno Válido
```javascript
import { validateEnvironment, assertValidEnvironment } from './services/envValidator';

process.env.PORT = "3002";
process.env.GEMINI_API_KEY = "clave_prueba_mas_larga_que_20_caracteres";
process.env.SENTINEL_API_TOKEN = "test_token_1234567890123456";

const result = validateEnvironment();
console.assert(result.valid === true, "Entorno válido pasa");
console.assert(result.values.PORT === 3002, "Puerto convertido a número");
```

#### Entorno Inválido
```javascript
process.env.PORT = "puerto_invalido";
process.env.SENTINEL_API_TOKEN = "corto";

const result = validateEnvironment();
console.assert(result.valid === false, "Entorno inválido falla");
console.assert(result.errors.length > 0, "Errores reportados");
console.log('Errores:', result.errors);
```

---

## Testing de Integración

### Flujo de Trabajo Completo

```javascript
// 1. Cargar video de evidencia
const formData = new FormData();
formData.append('video', videoFile);

const uploadResponse = await fetch('/api/reports/video?filename=evidence_001.mp4', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const uploadResult = await uploadResponse.json();
console.assert(uploadResult.saved, "Video cargado");

// 2. Generar geometría
const geometryResponse = await fetch('/api/ai/geometry', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ directives: "Test", image: imageBase64 })
});
const geometry = await geometryResponse.json();
console.assert(geometry.lines?.length > 0, "Geometría generada");

// 3. Analizar trayectoria
const auditResponse = await fetch('/api/ai/audit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    track: trackData,
    line: geometry.lines[0],
    directives: "Test"
  })
});
const auditResult = await auditResponse.json();
console.assert(auditResult.severity, "Auditoría completada");
```

---

## Testing de Rendimiento

### Benchmarking

```javascript
// Probar rendimiento de renderizado
const startTime = performance.now();
const { canvas, context, release } = getCanvasPool().acquire(1920, 1080);

// Renderizar 100 fotogramas
for (let i = 0; i < 100; i++) {
  context.drawImage(video, 0, 0, 1920, 1080);
  // Dibujar geometría
}

release();
const elapsed = performance.now() - startTime;
console.log(`100 fotogramas en ${elapsed.toFixed(2)}ms`);
console.log(`Promedio: ${(elapsed / 100).toFixed(2)}ms por fotograma`);
console.assert(elapsed < 1670, "60 FPS alcanzable"); // 100 fotogramas a 60fps = 1667ms
```

---

## Monitoreo y Diagnósticos

### Verificar Salud del Sistema
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer test_token_1234567890123456"
```

### Monitorear Logs
```bash
# Observar errores
tail -f server.log | grep "\[ERROR\]"

# Observar advertencias de rendimiento
tail -f server.log | grep "exceeded"

# Observar logs de auditoría
tail -f server.log | grep "API_AUDIT"
```

### Verificar Estado de Cola
```javascript
const stats = forensicQueueV3.getQueueStats();
console.log('Estadísticas de Cola:', {
  totalJobs: stats.totalJobs,
  pendingJobs: stats.pendingJobs,
  processingJobs: stats.processingJobs,
  avgRetries: stats.avgRetries,
  queueUtilization: stats.queueUtilization + '%'
});
```

---

## Lista de Verificación: Todas las Características

- [ ] Fase 1.4: Validación de entrada en todos los puntos finales
- [ ] Fase 1.4: Manejo de errores con fallbacks
- [ ] Fase 1.4: Autenticación de API (token Bearer)
- [ ] Fase 1.4: Limitación de velocidad funcionando
- [ ] Fase 1.4: Logging estructurado y logs de auditoría
- [ ] Fase 2.1: Persistencia de cola a IndexedDB
- [ ] Fase 2.1: Recuperación de cola después de actualizar
- [ ] Fase 2.1: Mecanismo de reintento con backoff exponencial
- [ ] Fase 2.2: Logs de auditoría de fallback en fallo
- [ ] Fase 2.3: Limpieza automática cada 5 minutos
- [ ] Fase 3: Detección de H.265 y advertencia
- [ ] Fase 3: Aceleración GPU habilitada
- [ ] Fase 3.1: Agrupación de lienzo funcionando
- [ ] Fase 3.1: Planificador RAF logrando 60 FPS
- [ ] Fase 4.1: Config centralizada accesible
- [ ] Fase 4.2: Validación de DTO pasando
- [ ] Fase 4.3: Validación de entorno al inicio
- [ ] Todos los puntos finales respondiendo con códigos de estado apropiados
- [ ] Sin fugas de memoria en renderizado
- [ ] Consola libre de errores

---

## Limitaciones Conocidas

1. **Aceleración GPU**: Requiere hardware compatible y controladores
2. **Análisis de IA**: Depende de disponibilidad de API Google Gemini
3. **Tamaño de Cola**: Limitado a 50 trabajos concurrentes por defecto
4. **Códec de Video**: Transcodificación H.265 añade 2-5 minutos de sobrecarga
5. **Grupo de Lienzo**: El navegador puede limitar memoria total del lienzo

---

## Versión: 1.0.0
**Última Actualización:** 22 de abril de 2026
