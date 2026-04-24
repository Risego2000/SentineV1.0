# FASE 6: Testing y Validación de Migración Electron

## Objetivo
Validar que todas las funcionalidades de SentinelV16 funcionan correctamente en modo Electron.

## Pre-requisitos para Testing
- ✅ FASE 1-4 completadas
- ✅ FFmpeg y Python bundled (FASE 5)
- ✅ `npm install` ejecutado
- ✅ `npm run build:electron` ejecutado

## Estrategia de Testing

### Nivel 1: Unit Testing (Electron IPC)
```bash
npm test
```

Tests a implementar:
- `electronDetect.ts` - Detectar si estamos en Electron
- `OCRSynchronizer.ts` - IPC vs HTTP fallback
- `aiService.ts` - IPC vs HTTP fallback

### Nivel 2: Integration Testing (Local Development)
```bash
npm run electron
```

Checklist:
- [ ] Ventana de Electron abre
- [ ] React app carga sin errores
- [ ] Servidor Express inicia (log: "Activo en: http://localhost:...")
- [ ] IPC bridge funciona (`window.electron` accesible)
- [ ] DevTools abre (F12)

### Nivel 3: Functional Testing (Core Features)

#### A. Video Upload & Detection
```
1. Abrir app
2. Upload video (test_video.mp4)
3. Verificar:
   - ✓ Video se carga en viewer
   - ✓ MediaPipe detecta vehículos
   - ✓ Bounding boxes aparecen
   - ✓ Tracks se siguen correctamente
```

#### B. OCR Functionality
```
1. Video con matrícula visible
2. Detener en vehicle con placa clara
3. Click "Extract Plate" o similar
4. Verificar:
   - ✓ OCR API call completa
   - ✓ Placa extraída correctamente
   - ✓ IPC handler ejecutó sin errores
```

**Debug**: Abrir DevTools (F12) y buscar logs:
```javascript
// Console debería mostrar:
[OCR] Extracting license plate...
[IPC] ocr:extractPlate called...
[OCR] Result: plate="2345ABC", candidates=[...]
```

#### C. AI Analysis (Geometry + Audit)
```
1. Crear geometría (líneas de infracción)
2. Detectar vehículo cruzando línea
3. Sistema debería:
   - ✓ Generar geometry (IPC: api:ai:geometry)
   - ✓ Analizar trayectoria (IPC: api:ai:audit)
   - ✓ Mostrar infracción detectada
   - ✓ Guardar en base de datos
```

**Debug console**:
```javascript
[API_DISCOVERY] Backend port from Electron: 3002
[IPC] api:ai:geometry called...
[IPC] api:ai:audit called...
[SENTINEL_SYSTEM] Infracción registrada: GIRO_PROHIBIDO
```

#### D. PDF Generation
```
1. Generar boletín de infracción
2. PDF debería descargarse
3. Verificar:
   - ✓ Contenido correcto
   - ✓ Formato PDF válido
   - ✓ Placa y timestamp correctos
```

#### E. Session Management
```
1. Crear sesión de cámara IP (si aplica)
2. Verificar:
   - ✓ Socket abierto
   - ✓ Stream proxy funciona
   - ✓ Desconexión limpia
```

### Nivel 4: System Testing

#### Rendimiento
```
- [ ] Detección de vehículos: <100ms por frame (MediaPipe)
- [ ] OCR: <500ms per request (PaddleOCR)
- [ ] AI Analysis: <2s per analysis (Gemini)
- [ ] Memory: <500MB después de 1 hora de uso
- [ ] CPU: <30% promedio (en i7)
```

#### Estabilidad
```
- [ ] App no crash después de 1 hora
- [ ] Reproducir varias veces = mismo resultado
- [ ] Cambiar entre videos sin error
- [ ] Múltiples análisis simultáneos (stress test)
```

#### Security
```
- [ ] Renderer NO puede acceder process.env (sandboxed)
- [ ] IPC valida inputs (no RCE possible)
- [ ] No hay exposición de Node.js APIs
- [ ] API keys no en console logs
```

### Nivel 5: Packaged App Testing

```bash
npm run build:dist
```

Instalar y probar:
```
1. Ejecutar SentinelV16-Setup.exe
2. Instalar en "C:\Program Files\SentinelV16"
3. Crear shortcut de escritorio
4. Abrir app
5. Verificar:
   - ✓ App inicia sin errores
   - ✓ Todas las funciones funcionan
   - ✓ Sin dependencias externas (Python, FFmpeg invisibles)
   - ✓ Desinstalar funciona limpiamente
```

## Test Automation Script

Crear `tests/electron-e2e.test.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Electron App', () => {
  test('should open window', async ({ app }) => {
    const window = await app.firstWindow();
    expect(window).toBeDefined();
  });

  test('should have React app loaded', async ({ app }) => {
    const window = await app.firstWindow();
    const title = await window.title();
    expect(title).toContain('SentinelV16');
  });

  test('should have IPC bridge available', async ({ app }) => {
    const window = await app.firstWindow();
    const electronAvailable = await window.evaluate(() => {
      return typeof window.electron !== 'undefined';
    });
    expect(electronAvailable).toBe(true);
  });

  test('should load video and detect vehicles', async ({ app }) => {
    const window = await app.firstWindow();
    // Simular video upload
    // Verificar detección de vehículos
  });
});
```

## Error Logs Esperados

### Normal Operation
```
[Electron] Main process initialized
[VITE] Auto-detected API port: 3002
[SENTINEL_SYSTEM] Activo en: http://localhost:3002
[API_DISCOVERY] Backend found on port 3002
[OCR] Extracting license plate...
[IPC] ocr:extractPlate called
```

### Problemas Comunes

#### Error: "Cannot find module 'electron'"
```
Solución: npm install
```

#### Error: "No such file or directory: dist/electron/main.js"
```
Solución: npm run build:electron
```

#### Error: "Port already in use"
```
Solución: Cambiar puerto en server.js o matar proceso anterior
lsof -ti:3002 | xargs kill -9
```

#### Error: "window.electron is undefined"
```
Solución: Verificar que preload.ts está en dist/electron/preload.js
Verificar main.ts: webPreferences.preload apunta a correcto path
```

#### Error: "IPC handler not registered"
```
Solución: 
1. Verificar que handler está en main.ts
2. Recompilar: npm run build:electron
3. Reiniciar app
```

## Performance Benchmarks

Crear `tests/performance.test.ts`:

```typescript
describe('Performance Benchmarks', () => {
  test('Video loading < 500ms', async () => {
    const start = performance.now();
    // Load video
    const end = performance.now();
    expect(end - start).toBeLessThan(500);
  });

  test('OCR extraction < 1000ms', async () => {
    const start = performance.now();
    // Run OCR
    const end = performance.now();
    expect(end - start).toBeLessThan(1000);
  });

  test('Memory after 1 hour < 500MB', async () => {
    // Run for 1 hour
    // Check memory usage
    expect(memoryUsage).toBeLessThan(500 * 1024 * 1024);
  });
});
```

## Regression Testing

Después de cada cambio importante, ejecutar:

```bash
# Unit tests
npm test

# Build
npm run build:electron
npm run build:vite

# Integration test
npm run electron
# Ejecutar todos los pasos de "Functional Testing"

# Packaging
npm run build:dist
# Instalar y probar el .exe
```

## Approval Checklist

Para marcar FASE 6 como COMPLETADA:

- [ ] Nivel 1: Unit tests pasan
- [ ] Nivel 2: Electron dev mode funciona
- [ ] Nivel 3A: Video upload y detection funciona
- [ ] Nivel 3B: OCR extrae placas correctamente
- [ ] Nivel 3C: AI analysis genera infracciones
- [ ] Nivel 3D: PDF generation funciona
- [ ] Nivel 3E: Session management funciona (si aplica)
- [ ] Nivel 4: Rendimiento aceptable
- [ ] Nivel 4: Estabilidad después de 1 hora
- [ ] Nivel 4: No hay exposición de security
- [ ] Nivel 5: Packaged app (.exe) funciona
- [ ] Regression: Todos los tests pasan

## Timeline

| Fase | Duración | Crítica? |
|------|----------|----------|
| Nivel 1 | 30 min | ✅ Sí |
| Nivel 2 | 15 min | ✅ Sí |
| Nivel 3 (A-E) | 90 min | ✅ Sí |
| Nivel 4 | 60 min | ⚠️ Opcional |
| Nivel 5 | 30 min | ✅ Sí |
| **Total** | **225 min (~3.75h)** | |

## References
- [Electron Testing](https://www.electronjs.org/docs/latest/api/app#event-ready)
- [Playwright for Electron](https://playwright.dev/docs/api/class-electron)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## Next Steps After Testing
1. **Documentation**: Actualizar README.md con instrucciones Electron
2. **Distribution**: Crear script de auto-update
3. **Analytics**: Agregar telemetría (opcional)
4. **Release**: Publicar v1.0 como Electron app
