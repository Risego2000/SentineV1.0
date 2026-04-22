# SentinelV16 API Documentation

## Overview

SentinelV16 is an AI-powered traffic enforcement system with advanced video processing, geometric detection, and forensic analysis capabilities. This documentation covers all API endpoints, services, and integration points.

---

## Authentication

All API requests require a valid Bearer token in the `Authorization` header:

```http
Authorization: Bearer <SENTINEL_API_TOKEN>
```

**Token Requirements:**
- Minimum 32 characters
- Alphanumeric with underscores and hyphens
- Set in environment variable `SENTINEL_API_TOKEN`

---

## Core API Endpoints

### 1. Video Transcoding

#### POST `/api/transcode`
Transcode video files with GPU acceleration support.

**Parameters:**
- `id` (query): Job ID for tracking
- `outputCodec` (query): Target codec (`h264`, `h265`, `hevc`) - default: `h264`
- Binary video data in request body

**Response:**
```json
{
  "progress": 0-100,
  "status": "transcoding|complete",
  "codec": "h264"
}
```

**Example:**
```bash
curl -X POST \
  "http://localhost:3002/api/transcode?id=job_001&outputCodec=h264" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: video/mp4" \
  --data-binary @video.mp4
```

#### GET `/api/transcode/progress`
Get transcoding progress for a job.

**Parameters:**
- `id` (query): Job ID

**Response:**
```json
{
  "progress": 45
}
```

#### GET `/api/transcode/status`
Get FFmpeg availability and system status.

**Response:**
```json
{
  "available": true,
  "ffmpeg": "/usr/bin/ffmpeg"
}
```

---

### 2. AI Geometry Generation

#### POST `/api/ai/geometry`
Generate detection geometry from road imagery using Gemini AI.

**Request Body:**
```typescript
{
  directives: string;        // Detection rules (required)
  instruction?: string;      // Additional instructions
  image?: string;            // Base64 encoded image (max 5MB)
}
```

**Response:**
```typescript
{
  lines: [
    {
      id: string;
      x1: number;           // 0-1 normalized
      y1: number;
      x2: number;
      y2: number;
      label: string;
      type: "forbidden" | "stop_line" | "lane_divider" | "box_junction" | "pedestrian" | "bus_lane";
    }
  ];
  suggestedDirectives: string;
  error?: string;           // Set if generation failed
}
```

**Example:**
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

### 3. AI Trajectory Analysis

#### POST `/api/ai/audit`
Analyze vehicle trajectory for traffic violations.

**Request Body:**
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
    x1: number;            // 0-1 normalized
    y1: number;
    x2: number;
    y2: number;
    label?: string;
    type?: string;
  };
  directives: string;      // Detection rules
  auditPreset?: "standard" | "strict" | "permissive";
}
```

**Response:**
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

### 4. IP Camera Integration

#### POST `/api/ip-camera/session`
Create a proxied session for IP camera streaming.

**Request Body:**
```json
{
  "url": "http://camera.local:8080/stream",
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "streamUrl": "/api/ip-camera/stream/{sessionId}"
}
```

#### GET `/api/ip-camera/stream/{sessionId}`
Access camera stream through proxy (session-based).

**CORS:** Restricted to `ALLOWED_ORIGINS`

---

### 5. Report Management

#### POST `/api/reports/save`
Save forensic report as PDF.

**Parameters:**
- `filename` (query): Report filename
- `date` (query, optional): Report date (YYYY-MM-DD)
- Binary PDF data in request body

**Response:**
```json
{
  "saved": true,
  "path": "/path/to/report"
}
```

#### POST `/api/reports/video`
Save evidence video with automatic transcoding.

**Parameters:**
- `filename` (query): Video filename
- `date` (query, optional): Report date
- Binary video data in request body

**Response:**
```json
{
  "saved": true,
  "path": "/path/to/video",
  "transcoded": true,
  "codec": "h264"
}
```

---

### 6. Configuration Management

#### POST `/api/save-config`
Save forensic detection configuration.

**Request Body:**
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

**Limits:**
- Filename: max 255 chars
- Config: max 1MB
- No path traversal allowed (`..`, `/`, `\`)

**Response:**
```json
{
  "saved": true,
  "path": "/preset/config_name.json"
}
```

#### GET `/api/presets`
List saved configuration presets.

**Response:**
```json
{
  "presets": ["config1.json", "config2.json"]
}
```

#### GET `/api/presets/{filename}`
Load a configuration preset.

**Response:** JSON configuration object

---

### 7. System Health

#### GET `/api/health`
System health check.

**Response:**
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

## Service Architecture

### Core Services

#### appConfig.ts
Centralized configuration management:
- Queue limits and retry policies
- Validation constraints
- API timeouts and rate limits
- Video codec support
- Feature flags

#### validators.ts
Input validation functions:
- `isValidGeometry()` - Coordinate bounds checking
- `isValidCodec()` - Video codec validation
- `isValidCameraUrl()` - URL and SSRF validation
- `isValidToken()` - Bearer token validation
- `isValidTrack()` - Trajectory structure validation

#### logger.ts
Structured logging system:
- `errorWithContext()` - Error logging with metadata
- `auditLog()` - API request auditing
- `validationError()` - Validation failure tracking
- `clearOldLogs()` - Automatic cleanup (24h TTL)

#### ForensicQueueV3.ts
Forensic audit job processing:
- **Queue Persistence**: IndexedDB persistence
- **Exponential Backoff**: 500ms × 2^retries, max 30s
- **Fallback Auditing**: Manual review logs for failed analysis
- **Auto Cleanup**: Every 5 minutes, 24h job expiry

#### canvasPool.ts
Canvas element reuse pool:
- Object pooling to reduce memory allocation
- LRU eviction when pool full
- Cache hit rate tracking
- ~30% performance improvement

#### rafScheduler.ts
Request Animation Frame scheduler:
- Frame-rate aware task scheduling
- Priority-based execution
- Dropped frame detection
- Throttling/debouncing utilities

#### optimizedRenderer.ts
Optimized rendering system:
- Integrates canvas pooling + RAF scheduling
- Geometry and track rendering
- Performance monitoring

---

## Rate Limiting

**Default Limits:**
- 120 requests per 60 seconds
- Applied to all `/api` endpoints
- Per IP address

**Response on Limit Exceeded:**
```json
{
  "error": "Rate limit excedido."
}
```

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message in Spanish",
  "details": {
    "field": "value",
    "code": "ERROR_CODE"
  }
}
```

**Common Error Codes:**
- `VALIDATION_FAILED` - Input validation error
- `OPERATION_TIMEOUT` - Request timeout
- `OPERATION_FAILED` - Generic operation failure
- `JSON_PARSE_ERROR` - JSON parsing failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Environment Variables

**Required:**
- `GEMINI_API_KEY` - Google Gemini API key (>20 chars)
- `SENTINEL_API_TOKEN` - API authentication token (32+ chars, alphanumeric)

**Optional:**
- `PORT` - Server port (default: 3002)
- `ALLOWED_ORIGINS` - CORS origins (default: `http://localhost:3001`)
- `REPORTS_DIR` - Report storage directory (default: `C:\Denuncias`)
- `TRANSCODE_MAX_BYTES` - Max video size (default: 250MB)
- `TRANSCODE_MAX_CONCURRENCY` - Max concurrent transcodes (default: 2)
- `API_RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 60000ms)
- `API_RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 120)

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| H.264 Transcode (GPU) | 2-5 min/hour | AMD/NVIDIA/Intel acceleration |
| H.265 Transcode (GPU) | 2-5 min/hour | Requires GPU support |
| AI Geometry Generation | 5-15 sec | Depends on image size |
| AI Trajectory Analysis | 10-30 sec | Includes OCR processing |
| Canvas Rendering | <5ms | 60 FPS target with RAF scheduling |

---

## Integration Examples

### Python Client
```python
import requests

headers = {"Authorization": f"Bearer {api_token}"}

# Submit video for transcoding
with open("video.mp4", "rb") as f:
    response = requests.post(
        "http://localhost:3002/api/transcode",
        params={"id": "job_001", "outputCodec": "h264"},
        data=f,
        headers=headers
    )

# Get transcoding progress
progress = requests.get(
    "http://localhost:3002/api/transcode/progress",
    params={"id": "job_001"},
    headers=headers
).json()
```

### JavaScript/Node.js
```javascript
const token = process.env.SENTINEL_API_TOKEN;

// AI Geometry Generation
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

## Compliance & Security

- **CORS**: Origin validation on all endpoints
- **Token Auth**: Required for all `/api` routes
- **Rate Limiting**: Per-IP request throttling
- **Input Validation**: Type-safe DTOs with validation
- **Audit Logging**: All API requests logged
- **Error Context**: Structured error information for debugging
- **Path Validation**: Prevents directory traversal attacks
- **SSRF Prevention**: IP address whitelist for camera connections

---

## Version Info

- **Current Version**: 1.0.0
- **Last Updated**: April 22, 2026
- **Supported Codecs**: H.264, H.265, HEVC
- **AI Engine**: Google Gemini 2.5 Flash
- **Framework**: Express.js + TypeScript
