# FASE 5: Bundling FFmpeg y Python/PaddleOCR

## Objetivo
Empacar FFmpeg y Python (con PaddleOCR) dentro del ejecutable de Electron para que usuarios no necesiten tenerlos instalados.

## Estructura de Directorios

```
SentinelV16/
├── resources/
│   ├── ffmpeg/
│   │   ├── ffmpeg.exe              (Windows)
│   │   ├── ffprobe.exe             (Windows)
│   │   ├── ffmpeg                  (Linux/macOS)
│   │   └── ffprobe                 (Linux/macOS)
│   └── python/
│       ├── python.exe              (Windows)
│       ├── python                  (Linux/macOS)
│       └── lib/                    (site-packages)
│           └── paddleocr/
│               └── ...
```

## Paso 1: Descargar FFmpeg

### Windows
```bash
# Descargar FFmpeg portable (https://ffmpeg.org/download.html)
# O usar wget/curl:

# Opción 1: BtbN release (recommended)
# https://github.com/BtbN/FFmpeg-Builds/releases
# Descargar: ffmpeg-master-latest-win64-gpl.zip

# Opción 2: Official releases
# https://ffmpeg.org/download.html#get-packages

# Pasos:
1. Descargar ffmpeg-master-latest-win64-gpl.zip
2. Extraer a resources/ffmpeg/
3. Mantener solo: ffmpeg.exe, ffprobe.exe
4. Eliminar archivos innecesarios (documentación, dll duplicados)
```

### Linux
```bash
# Usar gestor de paquetes
sudo apt-get install ffmpeg

# O descargar portable desde:
# https://github.com/BtbN/FFmpeg-Builds/releases
# ffmpeg-master-latest-linux64-gpl.tar.xz

# Copiar a resources/ffmpeg/
```

### macOS
```bash
# Usando Homebrew
brew install ffmpeg

# Copiar /usr/local/bin/ffmpeg y ffprobe a resources/ffmpeg/
```

## Paso 2: Descargar Python Embedded + PaddleOCR

### Windows
```bash
# Descargar Python embedded (https://www.python.org/downloads/windows/)
# Versión recomendada: Python 3.10.x (compatible con PaddleOCR)

# Pasos:
1. Descargar python-3.10.13-embed-amd64.zip
2. Extraer a resources/python/
3. Crear python_env.pth en resources/python/ con:
   Lib/site-packages
   ../

4. Instalar PaddleOCR y dependencias:
   cd resources/python
   ./python.exe -m pip install paddleocr
   ./python.exe -m pip install paddlepaddle pillow
```

### Linux/macOS
```bash
# Similar a Windows pero usar:
# python-3.10.13-embed-ubuntu-x86_64.tar.xz

# O compilar from source:
./configure --prefix=./python-install
make
make install

# Instalar PaddleOCR
./python-install/bin/python3 -m pip install paddleocr paddlepaddle pillow
```

## Paso 3: Configurar Paths en el Código

### electron/main.ts
```typescript
// FFmpeg path setup
const ffmpegPath = path.join(
  app.getAppPath(),
  'resources',
  'ffmpeg',
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);
process.env.FFMPEG_PATH = ffmpegPath;

// Python path setup
const pythonPath = path.join(
  app.getAppPath(),
  'resources',
  'python',
  process.platform === 'win32' ? 'python.exe' : 'bin/python'
);
process.env.PYTHON_PATH = pythonPath;
```

### server.js (FFmpeg initialization)
```javascript
// Ya existe en server.js, solo asegurar que usa
// process.env.FFMPEG_PATH si está definido

const ffmpegPath = process.env.FFMPEG_PATH || ('./node_modules/@ffmpeg-installer/ffmpeg/dist/ffmpeg');
const ffprobePath = process.env.FFPROBE_PATH || ('./node_modules/@ffprobe-installer/ffprobe/dist/ffprobe');

// Configurar fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
```

### services/paddleOcrService.js
```javascript
// Ya existe spawn('python', ...), solo asegurar que usa
// process.env.PYTHON_PATH si está definido

const pythonPath = process.env.PYTHON_PATH || 'python';
const process = spawn(pythonPath, [PADDLE_OCR_SCRIPT], { ... });
```

## Paso 4: Validar electron-builder.config.js

```javascript
// En electron-builder.config.js, agregar:
extraFiles: [
  {
    from: 'resources/ffmpeg',
    to: 'resources/ffmpeg',
    filter: ['**/*'],
  },
  {
    from: 'resources/python',
    to: 'resources/python',
    filter: ['**/*'],
  },
],
```

## Paso 5: Build y Test

```bash
# Compilar Vite
npm run build:vite

# Empacar con electron-builder (esto incluye resources/)
npm run build:dist

# Instalar el .exe y probar
# build/SentinelV16-Setup.exe
```

## Verificación

Para verificar que FFmpeg y Python están empaquetados:

```bash
# Dentro del .asar (app.asar es un zip):
unzip "C:\Program Files\SentinelV16\resources\app.asar"

# Verificar estructura:
ls resources/ffmpeg/      # Debe contener ffmpeg.exe, ffprobe.exe
ls resources/python/      # Debe contener python.exe + lib/site-packages
```

## Tamaños Esperados

- FFmpeg: ~50-100 MB
- Python: ~100-150 MB
- PaddleOCR models: ~50-100 MB
- **Total**: ~300-500 MB (instalado en disco)

## Alternativas a Considerar

### 1. Delta Updates
Usar `electron-updater` para descargar solo cambios entre versiones.

### 2. Lazy Loading
Descargar recursos (modelos de IA) la primera vez que se necesitan.

### 3. Separate Runtime Installer
Distribuir FFmpeg/Python separadamente (mayor complejidad para usuarios).

## Troubleshooting

### "ffmpeg not found"
```bash
# Verificar que existe:
ls resources/ffmpeg/ffmpeg.exe

# O establecer manualmente:
export FFMPEG_PATH=/path/to/ffmpeg
npm run dev:electron
```

### "Python not found"
```bash
# Verificar que existe:
ls resources/python/python.exe

# O establecer manualmente:
export PYTHON_PATH=/path/to/python
npm run dev:electron
```

### "PaddleOCR models not found"
PaddleOCR descarga modelos automáticamente a:
`~/.paddleocr/`

Para incluirlos en el app:
```bash
# Pre-descargar modelos
python resources/python/python.exe services/paddle_ocr_extractor.py

# Copiar caché a resources/paddleocr-models/
cp -r ~/.paddleocr/* resources/paddleocr-models/

# En code, configurar env var antes de usar PaddleOCR:
export PADDLEOCR_HOME=./resources/paddleocr-models
```

## References
- [FFmpeg Downloads](https://ffmpeg.org/download.html)
- [BtbN FFmpeg Builds](https://github.com/BtbN/FFmpeg-Builds)
- [Python Embedded](https://www.python.org/downloads/windows/)
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
- [Electron Builder - Files](https://www.electron.build/#files)

## Next Steps
1. Ejecutar las instrucciones de este documento
2. Testear que FFmpeg y Python funcionan en modo Electron
3. Proceder a FASE 6: Testing completo
