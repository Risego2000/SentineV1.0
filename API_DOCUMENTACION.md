# Documentación API SentinelV16

## Descripción General

SentinelV16 es un sistema de cumplimiento de tráfico impulsado por IA con capacidades avanzadas de procesamiento de video, detección geométrica y análisis forense. Esta documentación cubre todos los puntos finales de API, servicios y puntos de integración.

---

## Autenticación

Todas las solicitudes de API requieren un token Bearer válido en el encabezado `Authorization`:

```http
Authorization: Bearer <SENTINEL_API_TOKEN>
```

**Requisitos del Token:**
- Mínimo 32 caracteres
- Alfanuméricos con guiones bajos y guiones
- Establecido en la variable de entorno `SENTINEL_API_TOKEN`

---

## Puntos Finales Principales de la API

### 1. Transcodificación de Video

#### POST `/api/transcode`
Transcodificar archivos de video con soporte de aceleración GPU.

**Parámetros:**
- `id` (query): ID de trabajo para rastreo
- `outputCodec` (query): Códec de destino (`h264`, `h265`, `hevc`) - predeterminado: `h264`
- Datos de video binarios en el cuerpo de la solicitud

**Respuesta:**
```json
{
  "progress": 0-100,
  "status": "transcoding|complete",
  "codec": "h264"
}
```

**Ejemplo:**
```bash
curl -X POST \
  "http://localhost:3002/api/transcode?id=job_001&outputCodec=h264" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: video/mp4" \
  --data-binary @video.mp4
```

#### GET `/api/transcode/progress`
Obtener el progreso de transcodificación de un trabajo.

**Parámetros:**
- `id` (query): ID de trabajo

**Respuesta:**
```json
{
  "progress": 45
}
```

#### GET `/api/transcode/status`
Obtener disponibilidad de FFmpeg y estado del sistema.

**Respuesta:**
```json
{
  "available": true,
  "ffmpeg": "/usr/bin/ffmpeg"
}
```

---

### 2. Generación de Geometría de IA

#### POST `/api/ai/geometry`
Generar geometría de detección a partir de imágenes de carreteras usando IA Gemini.

**Cuerpo de la Solicitud:**
```typescript
{
  directives: string;        // Reglas de detección (requerido)
  instruction?: string;      // Instrucciones adicionales
  image?: string;            // Imagen codificada en base64 (máx 5MB)
}
```

**Respuesta:**
```typescript
{
  lines: [
    {
      id: string;
      x1: number;           // Normalizado 0-1
      y1: number;
      x2: number;
      y2: number;
      label: string;
      type: "forbidden" | "stop_line" | "lane_divider" | "box_junction" | "pedestrian" | "bus_lane";
    }
  ];
  suggestedDirectives: string;
  error?: string;           // Establecido si la generación falló
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "directives": "Detectar líneas continuas en vías principales",
    "instruction": "Enfocarse en carriles de circulación"
  }'
```

---

### 3. Análisis de Trayectoria de IA

#### POST `/api/ai/audit`
Analizar trayectoria de vehículo para violaciones de tráfico.

**Cuerpo de la Solicitud:**
```typescript
{
  track: {
    id: number;
    label: string;
    bbox: { x: number; y: number; w: number; h: number };
    avgVelocity: number;
    heading: number;
    dwellTime: number;
    roiHistory: string[];
    tail: { x: number; y: number }[];
    snapshots?: string[];
    contextSnapshots?: string[];
    zoomSnapshots?: string[];
  };
  line: {
    x1: number;            // Normalizado 0-1
    y1: number;
    x2: number;
    y2: number;
    label?: string;
    type?: string;
  };
  directives: string;      // Reglas de detección
  auditPreset?: "standard" | "strict" | "permissive";
}
```

**Respuesta:**
```typescript
{
  infraction: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  plate: string;
  description: string;
  reasoning: string[];
  videoTimeCode: string;
  legalBase: string;
  telemetry: {
    speedEstimated: string;
    behaviorAnomalies: string;
  };
  error?: string;
}
```

---

### 4. Integración de Cámara IP

#### POST `/api/ip-camera/session`
Crear una sesión proxificada para transmisión de cámara IP.

**Cuerpo de la Solicitud:**
```json
{
  "url": "http://camera.local:8080/stream",
  "username": "admin",
  "password": "password"
}
```

**Respuesta:**
```json
{
  "sessionId": "uuid-v4",
  "streamUrl": "/api/ip-camera/stream/{sessionId}"
}
```

#### GET `/api/ip-camera/stream/{sessionId}`
Acceder a la transmisión de cámara a través de proxy (basado en sesión).

**CORS:** Restringido a `ALLOWED_ORIGINS`

---

### 5. Gestión de Reportes

#### POST `/api/reports/save`
Guardar informe forense como PDF.

**Parámetros:**
- `filename` (query): Nombre de archivo del informe
- `date` (query, opcional): Fecha del informe (YYYY-MM-DD)
- Datos PDF binarios en el cuerpo de la solicitud

**Respuesta:**
```json
{
  "saved": true,
  "path": "/path/to/report"
}
```

#### POST `/api/reports/video`
Guardar video de evidencia con transcodificación automática.

**Parámetros:**
- `filename` (query): Nombre del archivo de video
- `date` (query, opcional): Fecha del informe
- Datos de video binarios en el cuerpo de la solicitud

**Respuesta:**
```json
{
  "saved": true,
  "path": "/path/to/video",
  "transcoded": true,
  "codec": "h264"
}
```

---

### 6. Gestión de Configuración

#### POST `/api/save-config`
Guardar configuración de detección forense.

**Cuerpo de la Solicitud:**
```json
{
  "fileName": "config_name.json",
  "config": {
    "protocolName": "string",
    "zoneNames": ["string"],
    "additionalContext": "string"
  }
}
```

**Límites:**
- Nombre de archivo: máx 255 caracteres
- Configuración: máx 1MB
- Sin recorrido de ruta permitido (`..`, `/`, `\`)

**Respuesta:**
```json
{
  "saved": true,
  "path": "/preset/config_name.json"
}
```

#### GET `/api/presets`
Listar configuraciones preestablecidas guardadas.

**Respuesta:**
```json
{
  "presets": ["config1.json", "config2.json"]
}
```

#### GET `/api/presets/{filename}`
Cargar una configuración preestablecida.

**Respuesta:** Objeto de configuración JSON

---

### 7. Salud del Sistema

#### GET `/api/health`
Verificación de salud del sistema.

**Respuesta:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "activeTranscodes": 1,
  "pendingAudits": 5,
  "ffmpegAvailable": true,
  "hardwareAcceleration": "amd",
  "reportsDir": "C:\\Denuncias",
  "timestamp": "2026-04-22T12:00:00Z"
}
```

---

## Arquitectura de Servicios

### Servicios Principales

#### appConfig.ts
Gestión centralizada de configuración:
- Límites de cola y políticas de reintentos
- Restricciones de validación
- Tiempos de espera y límites de velocidad de la API
- Soporte de códec de video
- Banderas de características

#### validators.ts
Funciones de validación de entrada:
- `isValidGeometry()` - Verificación de límites de coordenadas
- `isValidCodec()` - Validación de códec de video
- `isValidCameraUrl()` - Validación de URL y SSRF
- `isValidToken()` - Validación de token Bearer
- `isValidTrack()` - Validación de estructura de trayectoria

#### logger.ts
Sistema de registro estructurado:
- `errorWithContext()` - Registro de errores con metadatos
- `auditLog()` - Auditoría de solicitudes de API
- `validationError()` - Rastreo de errores de validación
- `clearOldLogs()` - Limpieza automática (TTL 24h)

#### ForensicQueueV3.ts
Procesamiento de trabajos de auditoría forense:
- **Persistencia de Cola**: Persistencia IndexedDB
- **Reintento Exponencial**: 500ms × 2^retries, máx 30s
- **Auditoría Alternativa**: Registros de revisión manual para análisis fallido
- **Limpieza Automática**: Cada 5 minutos, vencimiento de trabajo 24h

#### canvasPool.ts
Grupo de reutilización de elementos de lienzo:
- Agrupación de objetos para reducir asignación de memoria
- Desalojo LRU cuando la piscina está llena
- Rastreo de tasa de acierto de caché
- ~30% de mejora de rendimiento

#### rafScheduler.ts
Planificador de RequestAnimationFrame:
- Planificación consciente de la velocidad de fotogramas
- Ejecución basada en prioridades
- Detección de fotogramas descartados
- Utilidades de limitación/debouncing

#### optimizedRenderer.ts
Sistema de renderizado optimizado:
- Integra agrupación de lienzo + planificación RAF
- Renderizado de geometría y pistas
- Monitoreo de rendimiento

---

## Limitación de Velocidad

**Límites Predeterminados:**
- 120 solicitudes por 60 segundos
- Aplicado a todos los puntos finales `/api`
- Por dirección IP

**Respuesta al Exceder Límite:**
```json
{
  "error": "Límite de velocidad excedido."
}
```

---

## Manejo de Errores

Todos los puntos finales devuelven errores en un formato consistente:

```json
{
  "error": "Mensaje de error en español",
  "details": {
    "field": "value",
    "code": "ERROR_CODE"
  }
}
```

**Códigos de Error Comunes:**
- `VALIDATION_FAILED` - Error de validación de entrada
- `OPERATION_TIMEOUT` - Tiempo de espera agotado
- `OPERATION_FAILED` - Falla de operación genérica
- `JSON_PARSE_ERROR` - Error de análisis JSON
- `RATE_LIMIT_EXCEEDED` - Demasiadas solicitudes

---

## Variables de Entorno

**Requeridas:**
- `GEMINI_API_KEY` - Clave API de Google Gemini (>20 caracteres)
- `SENTINEL_API_TOKEN` - Token de autenticación de API (32+ caracteres, alfanuméricos)

**Opcionales:**
- `PORT` - Puerto del servidor (predeterminado: 3002)
- `ALLOWED_ORIGINS` - Orígenes CORS (predeterminado: `http://localhost:3001`)
- `REPORTS_DIR` - Directorio de almacenamiento de reportes (predeterminado: `C:\Denuncias`)
- `TRANSCODE_MAX_BYTES` - Tamaño máximo de video (predeterminado: 250MB)
- `TRANSCODE_MAX_CONCURRENCY` - Transcodificaciones concurrentes máximas (predeterminado: 2)
- `API_RATE_LIMIT_WINDOW_MS` - Ventana de limitación de velocidad (predeterminado: 60000ms)
- `API_RATE_LIMIT_MAX_REQUESTS` - Solicitudes máximas por ventana (predeterminado: 120)

---

## Características de Rendimiento

| Operación | Tiempo | Notas |
|-----------|--------|-------|
| Transcodificación H.264 (GPU) | 2-5 min/hora | Aceleración AMD/NVIDIA/Intel |
| Transcodificación H.265 (GPU) | 2-5 min/hora | Requiere soporte GPU |
| Generación de Geometría IA | 5-15 seg | Depende del tamaño de la imagen |
| Análisis de Trayectoria IA | 10-30 seg | Incluye procesamiento OCR |
| Renderizado de Lienzo | <5ms | Objetivo 60 FPS con planificación RAF |

---

## Ejemplos de Integración

### Cliente Python
```python
import requests

headers = {"Authorization": f"Bearer {api_token}"}

# Enviar video para transcodificación
with open("video.mp4", "rb") as f:
    response = requests.post(
        "http://localhost:3002/api/transcode",
        params={"id": "job_001", "outputCodec": "h264"},
        data=f,
        headers=headers
    )

# Obtener progreso de transcodificación
progress = requests.get(
    "http://localhost:3002/api/transcode/progress",
    params={"id": "job_001"},
    headers=headers
).json()
```

### JavaScript/Node.js
```javascript
const token = process.env.SENTINEL_API_TOKEN;

// Generación de Geometría IA
const geometryResponse = await fetch('/api/ai/geometry', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    directives: 'Detectar líneas prohibidas',
    image: base64EncodedImage
  })
});

const geometry = await geometryResponse.json();
```

---

## Cumplimiento y Seguridad

- **CORS**: Validación de origen en todos los puntos finales
- **Autenticación de Token**: Requerida para todas las rutas `/api`
- **Limitación de Velocidad**: Limitación de solicitudes por IP
- **Validación de Entrada**: DTOs seguros de tipos con validación
- **Registro de Auditoría**: Todos los solicitudes de API registradas
- **Contexto de Error**: Información de error estructurada para depuración
- **Validación de Ruta**: Previene ataques de recorrido de directorio
- **Prevención de SSRF**: Lista blanca de direcciones IP para conexiones de cámara

---

## Información de Versión

- **Versión Actual**: 1.0.0
- **Última Actualización**: 22 de abril de 2026
- **Códecs Compatibles**: H.264, H.265, HEVC
- **Motor de IA**: Google Gemini 2.5 Flash
- **Marco de Trabajo**: Express.js + TypeScript
