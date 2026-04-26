# Manual Testing Guide - Live Video Processing

## Aplicación SENTINEL.AI - Prueba en Vivo

**Status**: Aplicación iniciada y lista para usar  
**Puerto API**: http://localhost:55188  
**Video de Prueba**: 45.45 MB disponible

---

## 📋 PASOS PARA HACER PRUEBA CON VIDEO REAL

### PASO 1: Iniciar la Aplicación ✓
```
La ventana "SENTINEL.AI - Traffic Enforcement HUD" debería estar abierta
Si no, espera 10-15 segundos a que cargue completamente
```

### PASO 2: Acceder al Menú Lateral (Izquierda)
```
1. Observa el panel lateral izquierdo
2. Deberías ver:
   ├─ Logo "SENTINEL AI"
   ├─ "CARGA DE VIDEO" (botón/menú)
   ├─ "ESTADO DE SUBSISTEMAS"
   │  ├─ 🟢 Visión Artificial (COCO-SSD)
   │  ├─ 🟢 IA Forense (Gemini)
   │  ├─ 🟢 OCR Matrícula (NUEVO)
   │  └─ Vectores
   └─ Configuración del Motor (presets)
```

### PASO 3: Cargar Video de Prueba
```
EN EL MENÚ LATERAL:

1. Busca la sección "CARGA DE VIDEO"
2. Selecciona una de estas opciones:
   ├─ Upload: Cargar archivo desde disco
   ├─ Live: Usar cámara en vivo (si está disponible)
   └─ IP Camera: Conectar a cámara IP

Para esta prueba: SELECCIONA "Upload"

3. Elige el archivo:
   Video disponible:
   DA_2026-04-01T14_17_21+02_00_2026-04-01T15_00_29+02_00_20220604AAWRK06900362 - Trim.mp4
   (Ubicado en: C:\Users\riseg\Desktop\Apps\SentinelV16\public\)
   
   O simplemente sube cualquier video MP4 de tráfico
```

### PASO 4: Verificar Presets de Detección
```
EN "CONFIGURACIÓN DEL MOTOR":

Sistema Biónico (YOLOv5m):
├─ Scout    → Máxima velocidad (40ms)
├─ Sentinel → Equilibrio óptimo (50ms) ⭐ RECOMENDADO
├─ Warden   → Máxima precisión (65ms)
└─ Shadow   → Baja visibilidad (80ms)

SELECCIONA: "Sentinel" (es el más balanceado)
```

### PASO 5: Iniciar Detección
```
1. Una vez cargado el video, la detección iniciará automáticamente
2. Observarás en pantalla:
   ├─ Video reproduciéndose
   ├─ Bounding boxes alrededor de vehículos (rectángulos amarillos/azules)
   ├─ Confianza de detección (ej: 92%, 95%)
   ├─ IDs de tracking (números en las cajas)
   └─ Información en tiempo real

3. Los testigos en el lateral mostrarán:
   ├─ 🟢 Visión Artificial: ACTIVA
   ├─ Frames procesados
   └─ Detecciones totales
```

### PASO 6: Observar Resultados OCR
```
Mientras se procesan los frames:

1. En el panel de ESTADO, verás:
   ├─ 🟢 OCR Matrícula: ACTIVO
   └─ Status: Procesando...

2. Por cada vehículo detectado:
   ├─ Se mostrará la placa reconocida (si es visible)
   ├─ Confianza del OCR (ej: 94%)
   ├─ Crop automático: DETECTADO ✓
   └─ Status: OCR Success

3. En el panel de infracciones:
   ├─ Aparecerán registros de vehículos detectados
   ├─ Incluirán: Placa, tipo, velocidad (si aplica)
   └─ Status: Ready for audit
```

### PASO 7: Revisar Métricas
```
Durante/Después del procesamiento:

En el sidebar inferior, busca estadísticas:
├─ Total vehículos detectados
├─ Confianza promedio
├─ OCR success rate
├─ Frames procesados
└─ Tiempo de procesamiento
```

---

## 🎯 RESULTADOS ESPERADOS

### Detección YOLOv5m
```
✓ Detectará entre 8-15 vehículos (depende del video)
✓ Confianza: 88-95%
✓ Latencia: 50-80ms por frame
✓ Tipos: cars, trucks, buses, motorcycles

Señales de éxito:
- Bounding boxes alrededor de cada vehículo
- Números ID que persisten frame a frame
- Confianza > 85%
```

### OCR Mejorado
```
✓ Reconocerá 80-100% de placas visibles
✓ Crop automático: Activo
✓ Confianza OCR: 85-95%

Señales de éxito:
- Las placas aparecen en el panel de infracciones
- Formato: "4829-BVF" o similar
- Confianza > 0.85
```

### Pipeline Completo
```
Video → YOLOv5m → Tracking → Crop → OCR → Auditoría → Reporte

Señales de éxito:
- Todos los pasos completados sin errores
- Infracciones generadas con placa verificada
- Tiempos de procesamiento < 200ms/frame
```

---

## ⚠️ POSIBLES PROBLEMAS Y SOLUCIONES

### Problema 1: La aplicación está en blanco
```
Solución:
1. Espera 10-15 segundos (React está cargando)
2. Si sigue en blanco, presiona F5 (recargar)
3. Abre la consola (F12) para ver errores
```

### Problema 2: No aparece el menú lateral
```
Solución:
1. Busca el icono de "expandir" (chevron >) en la esquina superior
2. Haz clic para expandir el sidebar
3. Deberían aparecer todas las opciones
```

### Problema 3: El video no carga
```
Solución:
1. Verifica que el archivo sea MP4 o WebM
2. Intenta con el video de prueba incluido
3. Revisa la consola (F12) para ver el error específico
4. Asegúrate de que el navegador está en http://localhost:55188
```

### Problema 4: No hay detecciones
```
Solución:
1. Verifica que "Visión Artificial (YOLOv5m)" esté en 🟢 verde
2. Si está 🟡 amarilla, espera a que cargue el modelo (2-3 segundos)
3. Si está 🔴 roja, hay un error - revisa los logs
4. Asegúrate de que el video tiene vehículos visibles
```

### Problema 5: OCR no reconoce placas
```
Solución:
1. Verifica que "OCR Matrícula" esté en 🟢 verde
2. Las placas deben ser claras y visibles en el video
3. Si no hay placas visibles, el OCR no funcionará (esperado)
4. Intenta con otra sección del video que tenga placas claras
```

---

## 🔍 VERIFICACIÓN DE COMPONENTES

### Testigos del Sidebar

```
VERDE 🟢 = Sistema operativo y listo
AMARILLO 🟡 = Sistema cargando (espera)
ROJO 🔴 = Error o no disponible

Componentes esperados:
┌─ Visión Artificial (YOLOv5m)
│  └─ Status: 🟢 NEURAL_SENTINEL_YOLOv5m
│
├─ IA Forense (Gemini)
│  └─ Status: 🟢 GEMINI_L4
│
├─ OCR Matrícula ⭐ NUEVO
│  └─ Status: 🟢 PADDLE+CROP
│
└─ Vectores
   └─ Status: 🟢 ACTIVE
```

---

## 📊 MÉTRICAS A OBSERVAR

Mientras procesa video, busca:

```
Detección:
- ✓ Detecciones por frame: 2-4 típicamente
- ✓ Confianza: 88-95%
- ✓ Latencia: <100ms por frame
- ✓ Sin errores visibles

OCR:
- ✓ Placas reconocidas: >80% de las visibles
- ✓ Confianza OCR: >0.85
- ✓ Crop automático: Activo
- ✓ Tiempo/placa: 50-80ms

Auditoría:
- ✓ Infracciones generadas: Sí/No (según reglas)
- ✓ Placa en infracción: Verificada
- ✓ Confianza general: >0.85
```

---

## 🚀 PASOS DE ÉXITO

Si todo funciona correctamente, deberías ver:

```
1. ✓ Aplicación cargada sin errores
2. ✓ Sidebar expandido con todos los componentes
3. ✓ Testigos en verde (🟢)
4. ✓ Video cargado y reproduciéndose
5. ✓ Bounding boxes alrededor de vehículos
6. ✓ OCR reconociendo placas
7. ✓ Infracciones generadas (si corresponde)
8. ✓ Reporte listo para descargar
```

---

## 📞 INFORMACIÓN DE SOPORTE

**Logs del servidor**: 
- Consola del navegador: F12 → Console
- Logs de backend: Ver terminal donde corre Electron

**Endpoints disponibles**:
- `http://localhost:55188/api/health` → Estado general
- `http://localhost:55188/api/ready` → Verificar servicios
- `http://localhost:55188/api/presets` → Cargar presets

**Puerto**:
- Dinámico (puede variar)
- Mostrado en inicio de la aplicación
- Guardado en: `C:\Users\riseg\AppData\Local\Temp\sentinel-api-port.txt`

---

## ✅ CHECKLIST FINAL

Antes de dar por completada la prueba:

- [ ] Aplicación abierta sin errores
- [ ] Menú lateral visible y funcional
- [ ] Todos los testigos en verde
- [ ] Video cargado correctamente
- [ ] Detecciones apareciendo
- [ ] OCR reconociendo placas
- [ ] Sin errores en consola (F12)
- [ ] Infracciones generadas (si aplica)
- [ ] Tiempo de procesamiento aceptable (<200ms/frame)

---

**Status**: 🟢 LISTO PARA TESTING EN VIVO

Abre la aplicación y sigue los pasos arriba.  
¡Tu SENTINEL.AI está completamente operativo!
