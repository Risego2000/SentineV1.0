# SentinelV16 Electron - Guía de Configuración Manual

## Estado

✓ **FFmpeg**: Ya descargado e instalado  
⏳ **Python**: Descarga manual requerida  
⏳ **PaddleOCR**: Auto-instalable después de Python  

## Pasos de Configuración (5 minutos)

### Paso 1: Descargar Paquete Python Embebido

1. Visita: https://www.python.org/downloads/windows/
2. Desplázate hacia abajo a "Advanced"
3. Encuentra la sección **Python 3.10.x**
4. Descarga: **Windows embeddable package (64-bit)**
   - Debe llamarse: `python-3.10.x-embed-amd64.zip` (~50 MB)

### Paso 2: Extraer Python

1. Crea carpeta: `resources/python/` (en tu directorio SentinelV16)
2. Extrae el contenido del archivo zip directamente en `resources/python/`
3. Verifica: Deberías ver `python.exe` en `resources/python/python.exe`

**Estructura esperada:**
```
resources/
  python/
    python.exe
    python3.exe
    Lib/
    Scripts/
    (otros archivos...)
```

### Paso 3: Instalar PaddleOCR

Abre PowerShell o Símbolo del Sistema y ejecuta:

```bash
cd C:\Users\[TuUsuario]\Desktop\Apps\SentinelV16
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

Esto tomará 5-10 minutos (está descargando pesos de modelos ~200 MB).

### Paso 4: Verificar Instalación

Ejecuta la suite de pruebas:

```bash
npm run test:electron
```

Salida esperada:
```
✓ FFmpeg found
✓ Python found  
✓ PaddleOCR installed
✓ All tests passed
```

### Paso 5: Ejecutar la Aplicación

**Desarrollo:**
```bash
npm run electron
```

**Compilación de Producción:**
```bash
npm run build
```

Esto crea: `build/SentinelV16-Setup.exe`

---

## Alternativa: Descargar Python Manualmente (si lo anterior no funciona)

Si la página oficial de Python no está disponible:

1. Ve a: https://github.com/indygreg/python-build-standalone/releases
2. Encuentra la última versión con "cpython-3.10.x" (64-bit Windows)
3. Descarga la variante "install_only"
4. Extrae a `resources/python/`

---

## Solución de Problemas

### "FFmpeg not found"
FFmpeg ya debe estar instalado en: `resources/ffmpeg/ffmpeg.exe`

Si falta, ejecuta:
```bash
npm run download:ffmpeg
```

### "Python not found"
Sigue los Pasos 1-2 anteriores para descargar y extraer Python manualmente.

### "PaddleOCR not installed"
Ejecuta el Paso 3:
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

### Permiso denegado en pip install
Ejecuta PowerShell como Administrador e intenta de nuevo.

### ¿Aún tienes problemas?

1. Verifica que Python funciona:
   ```bash
   resources\python\python.exe --version
   ```

2. Verifica que pip funciona:
   ```bash
   resources\python\python.exe -m pip --version
   ```

3. Verifica la conexión de red (PaddleOCR descarga ~200 MB de modelos)

---

## Siguientes Pasos Después de la Configuración

Una vez que los 3 estén instalados:

1. Ejecuta pruebas:
   ```bash
   npm run test:electron
   ```

2. Lanza la aplicación dev:
   ```bash
   npm run electron
   ```

3. Prueba el flujo de trabajo completo en la aplicación:
   - Carga un video
   - Verifica la detección de vehículos (MediaPipe)
   - Verifica la detección de placas (PaddleOCR)
   - Genera un informe PDF

4. Compila para producción:
   ```bash
   npm run build
   ```

---

**Tiempo Total Estimado**: 30-45 minutos
- Descargar FFmpeg: ✓ Hecho (10 min)
- Descargar Python: 5-10 min
- Instalar PaddleOCR: 10-15 min
- Ejecutar pruebas: 2-5 min
- Compilar producción: 5 min

¡Ya casi está! Solo necesitas Python y PaddleOCR.
