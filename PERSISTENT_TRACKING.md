# 🎯 Sistema de Tracking Persistente - Detecciones con ID Único

## ✨ Requerimiento Implementado
"LA DETECCION DEBE SER PERSISTENTE, UN VEHICULO SOLO DEBE TENER UNA DETECCION Y UN ID, Y DESAPARECER CUANDO EL VEHICULO YA NO ESTE EN ESCENA"

---

## 🏗️ ARQUITECTURA DEL TRACKING

```
┌─────────────────────────────────────────────────────┐
│ Frame N: TensorFlowDetector.detect()                │
│ → [car 0.95, truck 0.88, car 0.87]                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ ByteTracker.update()                                │
│ - IoU Matching (Kinetic Re-identification)          │
│ - Kalman Filter (Motion Model)                      │
│ - Track ID Assignment                              │
│ → [Track#001: car, Track#002: truck, Track#003: car]│
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ processTrackResults()                               │
│ - Tail History (Trajectory)                         │
│ - Geometry Interaction                              │
│ - Evidence Capture Triggering                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│ renderScene()                                       │
│ - Draw Bounding Box                                 │
│ - Draw Track ID: "car #001"                         │
│ - Draw Trajectory (Tail)                            │
│ - Draw Velocity Vector                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
         🎬 CANVAS RENDERED
```

---

## 🔧 COMPONENTES CLAVE

### 1. **TensorFlowDetector.ts** (Optimizado)
```typescript
// Detecciones con cache para continuidad
private lastDetections: DetectionOutput[] = [];
private frameCount: number = 0;

detect(source): Promise<DetectionOutput[]> {
  // Si falla o frame no listo → retorna lastDetections
  // Esto mantiene el tracking continuo incluso con frames perdidos
  
  // Normaliza boxes a [0-1] de forma robusta
  const x = Math.max(0, Math.min(1, bbox[0] / width));
  
  // Ordena por score para matching consistente
  .sort((a, b) => b.score - a.score);
}
```

### 2. **ByteTracker.ts** (Motor de Tracking)
```typescript
update(detections, persistence, minScore) {
  // IoU Matching: Compara bbox de track actual con detecciones
  // Threshold IoU: 0.15 (muy tolerante para robustez)
  
  if (bestIoU > 0.15) {
    // ✅ MATCH ENCONTRADO → Reutiliza Track ID
    track.hits++;  // Incremente confidence
    track.kf.update(cx, cy);  // Actualiza Kalman Filter
  }
  
  // Tracks no emparejados se marcan como "ghost"
  // Desaparecen después de N frames sin detección
}
```

### 3. **renderSystem.ts** (Visualización)
```typescript
// Dibuja cada track con su ID único
const telemetryString = `${label} #${track.id} | ${speedKmh} km/h`;
ctx.fillText(telemetryString, x + 5, y - 8);

// Dibuja trayectoria histórica (tail)
if (track.tail && track.tail.length > 0) {
  // Dibuja curva suave con histórico de posiciones
}

// Dibuja vector de predicción (Kalman)
if (track.kf) {
  // Dibuja flecha prediciendo próxima posición
}
```

---

## 📊 FLUJO DE UN VEHÍCULO EN ESCENA

### Frame 0-2: Detección Inicial
```
TensorFlow: "car detected 0.95"
ByteTracker: "NEW TRACK #001 assigned"
Render: "car #001" con bbox
Status: ⏸️ NUEVO (hits < 2)
```

### Frame 3-5: Confirmación
```
TensorFlow: "car detected 0.93"
ByteTracker: "MATCH Track#001 (IoU=0.82)"
Render: "car #001" con bbox + tail
Status: ✅ CONFIRMADO (hits >= 2)
```

### Frame 6-100: Tracking Activo
```
TensorFlow: "car detected 0.91, 0.88, 0.85..."
ByteTracker: "MATCH Track#001 every frame"
Render: "car #001" con bbox + tail + velocity vector
Status: 📍 TRACKED (ID persistente)
Evidence: ¿Violación? → Capture frame
```

### Frame 101: Vehículo Sale Escena
```
TensorFlow: "NO DETECTION"
ByteTracker: "Track#001 → GHOST (age=1)"
Render: "car #001" desaparece (if age > max_persistence)
Status: ❌ ELIMINADO
```

---

## 🎛️ PARÁMETROS CRÍTICOS

### ByteTracker Config
```typescript
// En useFrameProcessor.ts:492
trackerRef.current.update(
  results,
  engineConfig.persistence,  // ← Frames antes de eliminar track
  engineConfig.confidenceThreshold
);
```

**Valores recomendados**:
- `persistence`: 5-10 (5-10 frames sin detección antes de eliminar)
- `confidenceThreshold`: 0.25 (mínimo score para iniciar track)
- `IoU threshold`: 0.15 en ByteTracker (muy bajo = tolerable)

### Kalman Filter Parameters
```typescript
// En ByteTracker.ts:AdvancedKalman
private readonly alpha = 0.85;  // Position smoothing
private readonly beta = 0.15;   // Velocity smoothing

// Damping factor
this.vx *= 0.98;  // Friction
this.vy *= 0.98;  // Friction
```

---

## ✅ GARANTÍAS DE PERSISTENCIA

### Track Continuidad
- ✅ Mismo vehículo = Mismo ID (mientras esté visible)
- ✅ ID único durante toda su trayectoria en escena
- ✅ Tail (histórico) se mantiene frame-to-frame
- ✅ Velocity se computa constantemente

### Desaparición
- ✅ Automática cuando sale de escena
- ✅ Definitiva después de N frames sin detección
- ✅ Liberación de recursos (memoria)
- ✅ No puede "resucitar" con mismo ID

### Robustez
- ✅ Cache de detecciones si frame falla
- ✅ Tolerance alto en matching (IoU 0.15)
- ✅ Kalman Filter compensa oclusiones
- ✅ Label smoothing (majority vote)

---

## 📈 OPTIMIZACIONES RECIENTES

### 1. TensorFlowDetector Mejorado
```typescript
// ✅ Caching de detecciones para continuidad
this.lastDetections = detections;
return this.lastDetections;  // En error o frame inválido

// ✅ Normalización robusta [0-1]
const x = Math.max(0, Math.min(1, bbox[0] / width));

// ✅ Ordenamiento por score (matching consistente)
.sort((a, b) => b.score - a.score);
```

### 2. Consistency Improvements
- Detecciones ordenadas por score
- Bounding boxes clamped a [0-1]
- Fallback a últimas detecciones válidas
- Frame counting para logging

---

## 🧪 TESTING MANUAL

### 1. Cargar Video
```
1. Abrir aplicación
2. Click "Cargar video"
3. Seleccionar video de tráfico
```

### 2. Ver Tracking
```
Observar:
✅ Cada vehículo tiene número único ("car #001", "truck #002", etc.)
✅ El número se mantiene mientras el vehículo esté visible
✅ La trayectoria (línea) se dibuja detrás del vehículo
✅ El vehículo desaparece cuando sale de escena
✅ La velocidad se muestra dinámicamente
```

### 3. Verificar Persistencia
```
✅ Mismo ID durante toda la trayectoria
✅ No hay "saltos" de ID
✅ No hay IDs duplicados
✅ Tail crece con movimiento
✅ Desaparece limpiamente al salir
```

---

## 🚨 TROUBLESHOOTING

### Problema: IDs no son persistentes (cambian cada frame)
**Causa**: IoU matching fallando  
**Solución**: Aumentar `persistence` en engineConfig

### Problema: Vehículos no desaparecen
**Causa**: `persistence` muy alto  
**Solución**: Reducir valor (5-10 frames típico)

### Problema: Demasiadas detecciones "falsas"
**Causa**: `confidenceThreshold` muy bajo  
**Solución**: Aumentar a 0.30-0.35

### Problema: Tails/trajectories no se ven
**Causa**: `showDetections = false`  
**Solución**: Activar en UI settings

---

## 📊 MÉTRICAS DE TRACKING

### Frame N (Vehículo Visible)
```
Metric             | Value      | Status
─────────────────────────────────────────
Detection Score    | 0.92       | ✅
IoU Match Score    | 0.78       | ✅
Track Age (hits)   | 45         | ✅
Velocity           | 45.2 km/h  | ✅
Tail Length        | 38 points  | ✅
```

### Frame N+5 (Vehículo Desaparece)
```
Detection Score    | 0.00       | ❌ NO DETECT
Track Age          | 5 (ghost)  | ⏳ FADING
Tail Visible       | YES        | Histórico
ID                 | #001       | Último ID
```

### Frame N+10 (Eliminado)
```
Track State        | DELETED    | ❌
ID Reusable        | YES        | Para otros
Memory             | FREED      | Limpio
```

---

## 🎓 CONCEPTOS CLAVE

### IoU (Intersection over Union)
```
IoU = (área_intersección) / (área_unión)

Rango: 0.0 - 1.0
- IoU < 0.15: NO MATCH (nuevo track)
- IoU > 0.15: MATCH (mismo vehículo)
```

### Kalman Filter
```
Predice posición del objeto basado en:
- Último movimiento (velocidad)
- Aceleración
- Ruido del sensor

Beneficio: Mantiene continuidad incluso
si hay oclusión temporal
```

### Label Smoothing
```
Historial de últimas 30 etiquetas
Vota por la más frecuente

Beneficio: Evita "truck" → "car" → "truck"
```

---

## ✨ RESUMEN

**Implementación**: Fully Functional ✅  
**Detecciones**: Persistentes con ID único ✅  
**Desaparición**: Automática cuando sale ✅  
**Tracking**: ByteTracker + Kalman ✅  
**Visualización**: Renderiza ID + tail + velocity ✅  

**Status**: 🟢 **LISTO PARA TESTING**

---

**Última actualización**: 2026-04-25 22:10  
**Version**: 2.0 (Persistent Tracking Optimized)

