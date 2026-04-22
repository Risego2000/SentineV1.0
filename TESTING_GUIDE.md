# SentinelV16 Testing Guide

## Overview

This guide provides comprehensive testing procedures for all SentinelV16 features implemented across Phases 1-4 and Phase 3.1.

---

## Test Environment Setup

### Prerequisites
- Node.js 16+ with TypeScript support
- FFmpeg with GPU acceleration (AMD/NVIDIA/Intel)
- Google Gemini API key
- Test video files in various codecs

### Configuration
Create `.env.local` for testing:
```bash
PORT=3002
GEMINI_API_KEY=<your-api-key>
SENTINEL_API_TOKEN=test_token_1234567890123456
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
NODE_ENV=test
```

---

## Phase 1: Security & Stability Testing

### 1.1 Input Validation Testing

#### Test Cases
```bash
# Valid geometry request
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "directives": "Detectar líneas prohibidas en vías principales",
    "instruction": "Enfocarse en carriles"
  }'

# Expected: 200 OK with geometry response

# Missing required directive
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{"image": "base64data"}'

# Expected: 400 Bad Request - "Las directivas deben ser texto."

# Image exceeds size limit (>5MB base64)
curl -X POST http://localhost:3002/api/ai/geometry \
  -H "Authorization: Bearer test_token_1234567890123456" \
  -H "Content-Type: application/json" \
  -d '{
    "directives": "Test",
    "image": "<6MB+ base64 string>"
  }'

# Expected: 413 Payload Too Large
```

### 1.2 Authentication Testing

#### Valid Token
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer test_token_1234567890123456"

# Expected: 200 OK with health status
```

#### Invalid Token
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer invalid_token"

# Expected: 401 Unauthorized
```

#### Missing Token
```bash
curl -X GET http://localhost:3002/api/health

# Expected: 401 Unauthorized
```

### 1.3 Error Handling Testing

#### AI Service Errors
```bash
# Valid request structure but AI service returns error
# Monitor logs for:
# - "[GEMINI] Parse error"
# - "[GEMINI] generateGeometry error"
# - Fallback response with error field

# Expected: 200 OK with error info
{
  "lines": [],
  "suggestedDirectives": "Error en generación automática...",
  "error": "JSON parsing error..."
}
```

#### Audit Logging
```bash
# Check server logs for audit entries
tail -f server.log | grep "API_AUDIT"

# Expected output:
# [TIMESTAMP] [INFO] [API_AUDIT] POST /api/ai/geometry [200]
```

---

## Phase 2: Persistence & Resilience Testing

### 2.1 Queue Persistence Testing

#### Setup Test
```javascript
// Clear IndexedDB
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase('sentinel_forensic_queue');
  request.onsuccess = () => resolve();
  request.onerror = () => reject();
});
```

#### Queue Persistence Test
```javascript
// 1. Enqueue forensic jobs
const queue = new ForensicQueueV3();
queue.enqueue(trackData, geometryData, evidenceId, localTime, videoTimeCode, playbackTime);

// 2. Check IndexedDB storage
const persistence = new ForensicQueuePersistence();
const items = await persistence.loadQueueItems();
console.assert(items.length > 0, "Queue items persisted");

// 3. Refresh browser
location.reload();

// 4. Verify queue restored
const stats = queue.getQueueStats();
console.assert(stats.totalJobs > 0, "Queue restored after refresh");
```

### 2.2 Exponential Backoff Testing

#### Simulate Failure and Retry
```javascript
// Monitor retry delays in logs
// Expected pattern:
// [1st attempt] Job queued
// [Error] AI timeout - retrying in 500ms (attempt 1/5)
// [Retry] Retrying in 1000ms (attempt 2/5)
// [Retry] Retrying in 2000ms (attempt 3/5)
// [Retry] Retrying in 4000ms (attempt 4/5)
// [Retry] Retrying in 8000ms (attempt 5/5)
// [Failed] Manual review created after 5 retries

const backoffDelay = (retries) => 500 * Math.pow(2, retries - 1);
// Verify: backoffDelay(1) = 500, backoffDelay(5) = 8000
```

### 2.3 Fallback Auditing Testing

#### Trigger Permanent Failure
```javascript
// Simulate API failure after max retries
// Expected behavior:
// 1. Job marked as failed
// 2. Fallback audit log created with:
//    - infraction: false
//    - severity: "CRITICAL"
//    - ruleCategory: "MANUAL_REVIEW"
//    - description: "Análisis automático falló. Requiere revisión manual..."
// 3. Evidence preserved in fallback log
// 4. Logged for operator review
```

---

## Phase 3: Performance & H.265 Testing

### 3.1 H.265 Detection Testing

#### Test H.265 Upload Detection
```javascript
// Test file detection
const h265File = new File(
  [h265VideoBlob],
  'video.h265',
  { type: 'video/mp4' }
);

const codec = await detectVideoCodec(h265File);
console.assert(codec === 'hevc', "H.265 detected correctly");
```

#### Test H.265 Warning Dialog
```javascript
// 1. Upload H.265 file via UI
// Expected: Warning dialog appears
// - "Vídeo H.265 Detectado"
// - Options: Cancel or "Subir de Todas Formas"

// 2. Click "Cancel"
// Expected: Upload aborted

// 3. Upload again, click "Subir de Todas Formas"
// Expected: Upload proceeds, server transcodes to H.264
```

### 3.2 GPU Acceleration Testing

#### Verify GPU Detection
```bash
node -e "
const { execSync } = require('child_process');
const ffmpegHelp = execSync('ffmpeg -encoders 2>&1').toString();
const hasGPU = ffmpegHelp.includes('h264_amf') || 
               ffmpegHelp.includes('h264_nvenc') || 
               ffmpegHelp.includes('h264_qsv') ||
               ffmpegHelp.includes('h264_videotoolbox');
console.log('GPU Available:', hasGPU);
"

# Expected output: GPU Available: true
```

#### Benchmark Transcoding
```bash
# Measure transcoding time
time ffmpeg -i input.h265 -c:v h264_amf -usage transcoding output.mp4

# Expected: <5 minutes for 1 hour of video with GPU
```

### 3.3 Canvas & RAF Optimization Testing

#### Canvas Pool Testing
```javascript
import { getCanvasPool } from './services/canvasPool';

const pool = getCanvasPool();

// Acquire canvas
const { canvas, context, release } = pool.acquire(1920, 1080);

// Use canvas...
context.drawImage(video, 0, 0, 1920, 1080);

// Release back to pool
release();

// Check statistics
const stats = pool.getStats();
console.log('Pool Size:', stats.poolSize);        // Should be ≤ maxPoolSize
console.log('Cache Hit Rate:', stats.cacheHitRate); // Should be > 50% after warmup
console.log('In Use:', stats.inUse);               // Should decrease after releases
```

#### RAF Scheduler Testing
```javascript
import { getRAFScheduler, scheduleFrame } from './services/rafScheduler';

const scheduler = getRAFScheduler();
let frameCount = 0;

// Schedule frame task
const unschedule = scheduleFrame('test-task', (deltaTime) => {
  frameCount++;
  console.log(`Frame ${frameCount}, deltaTime: ${deltaTime.toFixed(2)}ms`);
});

// After 1 second, check metrics
setTimeout(() => {
  unschedule();
  const stats = scheduler.getStats();
  console.log('Frame Rate:', stats.frameRate);     // Should be ~60 FPS
  console.log('Task Execution Time:', stats.lastTaskExecutionTime); // Should be <16.67ms
}, 1000);
```

---

## Phase 4: Architecture & Type Safety Testing

### 4.1 Configuration Testing

#### Test appConfig
```javascript
import { AppConfig, QueueConfig } from './services/appConfig';

// Verify configuration values
console.assert(QueueConfig.MAX_RETRIES === 5, 'Retry config');
console.assert(AppConfig.Validation.MAX_IMAGE_SIZE_MB === 5, 'Image size limit');
console.assert(AppConfig.Features.ENABLE_QUEUE_PERSISTENCE === true, 'Features enabled');
```

### 4.2 DTO Validation Testing

#### Valid Request
```javascript
import { AIGeometryRequestValidator } from './services/dtoValidation';

const validData = {
  directives: "Test directives",
  instruction: "Test instruction",
  image: "base64string"
};

const result = AIGeometryRequestValidator.validate(validData);
console.assert(result.valid === true, "Valid DTO passes");
console.assert(result.value.directives === "Test directives", "Values extracted");
```

#### Invalid Request
```javascript
const invalidData = {
  directives: "", // Empty string
  image: "x".repeat(6 * 1024 * 1024) // 6MB+
};

const result = AIGeometryRequestValidator.validate(invalidData);
console.assert(result.valid === false, "Invalid DTO fails");
console.assert(result.path === "$.directives", "Error path specified");
```

### 4.3 Environment Validation Testing

#### Valid Environment
```javascript
import { validateEnvironment, assertValidEnvironment } from './services/envValidator';

process.env.PORT = "3002";
process.env.GEMINI_API_KEY = "test_key_longer_than_20_chars";
process.env.SENTINEL_API_TOKEN = "test_token_1234567890123456";

const result = validateEnvironment();
console.assert(result.valid === true, "Valid environment passes");
console.assert(result.values.PORT === 3002, "Port converted to number");
```

#### Invalid Environment
```javascript
process.env.PORT = "invalid_port";
process.env.SENTINEL_API_TOKEN = "short";

const result = validateEnvironment();
console.assert(result.valid === false, "Invalid environment fails");
console.assert(result.errors.length > 0, "Errors reported");
console.log('Errors:', result.errors);
```

---

## Integration Testing

### End-to-End Workflow

```javascript
// 1. Upload evidence video
const formData = new FormData();
formData.append('video', videoFile);

const uploadResponse = await fetch('/api/reports/video?filename=evidence_001.mp4', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
const uploadResult = await uploadResponse.json();
console.assert(uploadResult.saved, "Video uploaded");

// 2. Generate geometry
const geometryResponse = await fetch('/api/ai/geometry', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ directives: "Test", image: imageBase64 })
});
const geometry = await geometryResponse.json();
console.assert(geometry.lines?.length > 0, "Geometry generated");

// 3. Analyze trajectory
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
console.assert(auditResult.severity, "Audit completed");
```

---

## Performance Testing

### Benchmarking

```javascript
// Test rendering performance
const startTime = performance.now();
const { canvas, context, release } = getCanvasPool().acquire(1920, 1080);

// Render 100 frames
for (let i = 0; i < 100; i++) {
  context.drawImage(video, 0, 0, 1920, 1080);
  // Draw geometry
}

release();
const elapsed = performance.now() - startTime;
console.log(`100 frames in ${elapsed.toFixed(2)}ms`);
console.log(`Average: ${(elapsed / 100).toFixed(2)}ms per frame`);
console.assert(elapsed < 1670, "60 FPS achievable"); // 100 frames at 60fps = 1667ms
```

---

## Monitoring & Diagnostics

### Check System Health
```bash
curl -X GET http://localhost:3002/api/health \
  -H "Authorization: Bearer test_token_1234567890123456"
```

### Monitor Logs
```bash
# Watch for errors
tail -f server.log | grep "\[ERROR\]"

# Watch for performance warnings
tail -f server.log | grep "exceeded"

# Watch audit logs
tail -f server.log | grep "API_AUDIT"
```

### Check Queue Status
```javascript
const stats = forensicQueueV3.getQueueStats();
console.log('Queue Stats:', {
  totalJobs: stats.totalJobs,
  pendingJobs: stats.pendingJobs,
  processingJobs: stats.processingJobs,
  avgRetries: stats.avgRetries,
  queueUtilization: stats.queueUtilization + '%'
});
```

---

## Checklist: All Features

- [ ] Phase 1.4: Input validation on all endpoints
- [ ] Phase 1.4: Error handling with fallbacks
- [ ] Phase 1.4: API authentication (Bearer token)
- [ ] Phase 1.4: Rate limiting working
- [ ] Phase 1.4: Structured logging and audit logs
- [ ] Phase 2.1: Queue persistence to IndexedDB
- [ ] Phase 2.1: Queue recovery after refresh
- [ ] Phase 2.1: Exponential backoff retry mechanism
- [ ] Phase 2.2: Fallback audit logs on failure
- [ ] Phase 2.3: Automatic cleanup every 5 minutes
- [ ] Phase 3: H.265 detection and warning
- [ ] Phase 3: GPU acceleration enabled
- [ ] Phase 3.1: Canvas pooling working
- [ ] Phase 3.1: RAF scheduler achieving 60 FPS
- [ ] Phase 4.1: Centralized config accessible
- [ ] Phase 4.2: DTO validation passing
- [ ] Phase 4.3: Environment validation at startup
- [ ] All endpoints responding with proper status codes
- [ ] No memory leaks in rendering
- [ ] Console clear of errors

---

## Known Limitations

1. **GPU Acceleration**: Requires compatible hardware and drivers
2. **AI Analysis**: Depends on Google Gemini API availability
3. **Queue Size**: Limited to 50 concurrent jobs by default
4. **Video Codec**: H.265 transcoding adds 2-5 minutes overhead
5. **Canvas Pool**: Browser may limit total canvas memory

---

## Version: 1.0.0
**Last Updated:** April 22, 2026
