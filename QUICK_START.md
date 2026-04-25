# SentinelV16 Electron - Guía de Inicio Rápido

## ✅ Estado
- Configuración Electron: COMPLETADA
- Sistema de construcción: COMPLETADO  
- Integración React: COMPLETADA
- Integración del backend: COMPLETADA
- Suite de pruebas: COMPLETADA

## ⏳ Qué Falta
- Binario FFmpeg (~150 MB) - **Descarga manual requerida**
- Runtime de Python (~100 MB) - **Descarga manual requerida**
- Paquete PaddleOCR - **Auto-instalable una vez Python esté listo**

## 🚀 Comienza Aquí (5 minutos)

### Opción A: Instalación Automática (Recomendada)
```bash
# Esto te guiará a través de las descargas
npm run install:all
```

### Opción B: Instalación Manual

**Paso 1: Descargar FFmpeg (5 min)**
```
1. https://github.com/BtbN/FFmpeg-Builds/releases
2. Descarga: ffmpeg-master-latest-win64-gpl.zip
3. Extrae a: resources/ffmpeg/
4. Conserva: ffmpeg.exe, ffprobe.exe
5. Elimina: Todo lo demás
```

**Paso 2: Descargar Python (5 min)**
```
1. https://www.python.org/downloads/windows/
2. Encuentra Python 3.10.13
3. Descarga: Windows embeddable package (64-bit)
4. Extrae a: resources/python/
```

**Paso 3: Instalar PaddleOCR (10 min)**
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

## ✔️ Verificar Instalación
```bash
npm run test:electron
```

Salida esperada:
```
✓ FFmpeg found
✓ Python found
✓ PaddleOCR installed
```

## 🎮 Ejecutar Aplicación

**Desarrollo:**
```bash
npm run electron
```

**Compilación de Producción:**
```bash
npm run build
# Salida: build/SentinelV16-Setup.exe
```

## 📋 Lista de Verificación de Testing

Una vez en ejecución, verifica:
- [ ] La ventana se abre sin errores
- [ ] La aplicación React carga (sin errores rojos en consola)
- [ ] DevTools funciona (F12)
- [ ] Puedes cargar un video
- [ ] MediaPipe detecta vehículos
- [ ] OCR extrae placas correctamente
- [ ] El análisis de IA genera infracciones
- [ ] Se generan informes PDF

## 🐛 Solución de Problemas

### "FFmpeg not found"
```bash
npm run download:ffmpeg
# O coloca manualmente ffmpeg.exe, ffprobe.exe en resources/ffmpeg/
```

### "Python not found"
```bash
npm run download:python
# O extrae manualmente Python a resources/python/
```

### "PaddleOCR not installed"
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

### "window.electron is undefined"
```bash
npm run build:electron
npm run electron
```

## 📚 Más Documentación

- `README_ELECTRON.md` - Guía completa
- `NEXT_STEPS.md` - Recorrido detallado
- `PHASE6_TESTING.md` - Estrategia de testing

## ⏱️ Tiempo Estimado

| Tarea | Tiempo |
|------|--------|
| Descargar FFmpeg | 5-10 min |
| Descargar Python | 5-10 min |
| Instalar PaddleOCR | 10-15 min |
| Probar aplicación | 5 min |
| Compilar producción | 5 min |
| **Total** | **30-50 min** |

---

**¡Ya estás al ~95%! Solo necesitas descargar los archivos e instalar PaddleOCR!**
