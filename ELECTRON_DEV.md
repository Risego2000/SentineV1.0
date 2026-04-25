# SentinelV16 - Guía de Desarrollo de Electron

## Ejecutar en Electron (Modo Desarrollo)

### Requisitos Previos
- Node.js 18+ instalado
- Todas las dependencias npm instaladas (`npm install`)

### Iniciar Entorno de Desarrollo de Electron

```bash
# Configuración única: Compilar archivos Electron
npm run build:electron

# Iniciar Electron + servidor Vite dev en paralelo
npm run electron
```

Esto hará:
1. Inicia servidor Vite en `http://localhost:5173` (hot reload)
2. Inicia el proceso principal de Electron, que inicializa el backend Express en un puerto libre
3. Pasa el puerto del backend al renderer vía IPC

### O Ejecutar Separadamente (para depuración)

**Terminal 1: Iniciar frontend Vite**
```bash
npm run dev
```

**Terminal 2: Iniciar Electron**
```bash
npm run dev:electron
```

**Terminal 3: (Opcional) Iniciar backend Express separadamente**
```bash
npm run dev:api
```

## Compilación para Distribución

```bash
# Compilar Vite + Electron + Paquete
npm run build

# Salida: build/SentinelV16-Setup.exe (Windows)
```

## Arquitectura

### Proceso Principal de Electron
- Archivo: `electron/main.ts` → compilado a `dist/electron/main.js`
- Responsabilidades:
  - Crear ventana de aplicación
  - Inicializar backend Express
  - Manejar solicitudes IPC del renderer
  - Reenviar llamadas API al servidor Express en localhost

### Renderer de Electron (React)
- Archivo: `App.tsx` y componentes React
- Capacidades:
  - Manipulación regular del DOM vía React
  - Llamadas IPC vía `window.electron.ipc.invoke()`
  - No puede acceder directo a Node.js (sandboxed)

### Comunicación IPC
- **Preload**: `electron/preload.ts` (puente seguro)
- **Métodos expuestos**:
  - `window.electron.ipc.invoke(channel, data)` - Llamar al proceso principal
  - `window.electron.app.getAppPath(pathName)` - Obtener rutas de aplicación
  - `window.electron.window.*` - Controles de ventana

### Servicios con Soporte IPC
- **OCRSynchronizer**: Detecta Electron, usa IPC para endpoints `/api/ocr/*`
- **AIService**: Detecta Electron, usa IPC para endpoints `/api/ai/*`
- Fallback a HTTP cuando no está en Electron (modo web)

## Variables de Entorno

Ninguna requerida para desarrollo básico. En producción:
- `GEMINI_API_KEY` - Para análisis de IA Gemini
- `SUPABASE_URL` - Para autenticación Supabase
- `SUPABASE_ANON_KEY` - Para cliente Supabase

## Solución de Problemas

### "Cannot find module 'express'"
Ejecuta `npm install` para instalar dependencias.

### Preload permission denied
Asegúrate de que `electron/preload.ts` está correctamente compilado a `dist/electron/preload.js`.

### IPC handler not found
Verifica que:
1. El handler esté registrado en `electron/main.ts` vía `ipcMain.handle()`
2. El servicio llame `window.electron.ipc.invoke()` con el nombre de canal correcto
3. El proceso principal fue recompilado (ejecuta `npm run build:electron`)

### Conflictos de puerto
Electron asigna un puerto libre automáticamente. Si necesitas un puerto específico, modifica `electron/main.ts`.

## Siguientes Pasos

1. **FASE 5**: Empaquetar FFmpeg y Python con Electron
2. **FASE 6**: Testing comprensivo (todas las características funcionan en Electron)
3. **Distribución**: Compilar instaladores para Windows/macOS/Linux

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────┐
│        Proceso Principal de Electron            │
│  ┌──────────────────────────────────────────┐  │
│  │ electron/main.ts                         │  │
│  ├──────────────────────────────────────────┤  │
│  │ - Gestión de Ventana                     │  │
│  │ - Servidor Express (localhost:3002+)     │  │
│  │ - Registro de Manejadores IPC            │  │
│  └──────────────────────────────────────────┘  │
│           ↕ Puente IPC (preload.ts)            │
└──────────────┬────────────────────────────────┘
               │
       ┌───────▼────────┐
       │ Renderer       │
       │ (Aplicación    │
       │  React)        │
       │ - App.tsx      │
       │ - Servicios    │
       │  (IPC aware)   │
       └────────────────┘
```

## Referencias
- [Documentación Electron](https://www.electronjs.org/docs)
- [Comunicación IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Isolation y Preload](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
