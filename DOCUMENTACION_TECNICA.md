# Documento de Implementación del Sistema Sentinel AI

## 1. Introducción
Sentinel AI es un sistema avanzado de detección de infracciones de tráfico que combina visión artificial, inteligencia artificial y análisis forense para identificar y documentar violaciones de normas de tráfico en tiempo real.

## 2. Arquitectura del Sistema
### 2.1 Componentes Principales
#### 2.1.1 Sistema de Detección de Infracciones (Heuristic Rule Engine)
*   **Responsabilidad:** Procesar datos en tiempo real y detectar comportamientos anómalos basados en reglas de tráfico.
*   **Ubicación:** `hooks/useFrameProcessor.ts`
*   **Función:** Tomar datos del tracker y aplicar lógica heurística para identificar infracciones.

#### 2.1.2 Sistema de Líneas (Spatial Geometry System)
*   **Responsabilidad:** Definir umbrales virtuales para detección de infracciones.
*   **Ubicación:** `components/renderSystem.ts`, `utils.ts`
*   **Función:** Implementar geometría espacial para detectar cruces de líneas y áreas prohibidas.

#### 2.1.3 Sistema de Análisis Forense (Neural Forensic Audit)
*   **Responsabilidad:** Validar infracciones con IA multimodal.
*   **Ubicación:** `services/aiService.ts`, `components/useSentinelSystem.ts`
*   **Función:** Analizar evidencia y generar informes forenses.

### 2.2 Flujos de Datos
`Video Input → MediaPipe Detection → ByteTracker → Process Frame → Geometry Intersection → Audit → Infraction Log`

## 3. Requisitos del Sistema
### 3.1 Requisitos de Hardware
*   **CPU:** Mínimo 4 cores, recomendado 8+ cores.
*   **RAM:** Mínimo 8GB, recomendado 16GB+.
*   **GPU:** Compatible con WebGL 2.0 (para aceleración de detección).
*   **Almacenamiento:** 500MB espacio libre para cache.

### 3.2 Requisitos de Software
*   Node.js v18 o superior.
*   Navegador compatible con WebAssembly y MediaPipe.
*   API Key de Google Gemini para funcionalidades de IA.

### 3.3 Dependencias
*   `@google/genai`: SDK para Google Gemini.
*   `lucide-react`: Iconos.
*   `jspdf`: Generación de PDF.
*   `MediaPipe`: Biblioteca de detección.

## 4. Configuración del Entorno
### 4.1 Variables de Entorno
`VITE_GOOGLE_GENAI_KEY=your_gemini_api_key_here`

### 4.2 Instalación
```bash
npm install
npm run dev
```

## 5. Implementación de Componentes
### 5.1 Sistema de Detección de Infracciones
#### 5.1.1 Funcionalidad Principal
*   Procesamiento de frames en tiempo real.
*   Cálculo de cinemática de vehículos.
*   Detección de intersecciones con líneas geométricas.
*   Validación de infracciones STOP.

#### 5.1.2 Implementación
```typescript
// En useFrameProcessor.ts
const processTrackResults = useCallback((activeTracks: any[], v: HTMLVideoElement, canvas: HTMLCanvasElement) => {
  // Lógica de detección de infracciones
  // Validación de STOP (dwellTime > 3000ms)
  // Captura de snapshots (Contexto + Zoom)
  // Llamada a runAudit
}, [geometry, runAudit]);
```

### 5.2 Sistema de Líneas
#### 5.2.1 Tipos de Líneas
*   `forbidden`: Zonas prohibidas de acceso.
*   `stop_line`: Líneas de detención.
*   `lane_divider`: Divisores de carril.
*   `box_junction`: Áreas poligonales de detección por bloqueo.

#### 5.2.2 Implementación
```typescript
// En renderSystem.ts
geometry.forEach((line) => {
  // Dibujo de líneas con estilos diferenciados y efecto Glow
  // Soporte para polígonos (box_junction)
});
```

### 5.3 Sistema de Análisis Forense
#### 5.3.1 Flujo de Trabajo
1.  Captura de imágenes del vehículo (Ráfaga forense).
2.  Envío a Gemini para análisis técnico-legal.
3.  Generación de informe forense (Marca, Modelo, Placa, RGC).
4.  Almacenamiento de infracción en el Log interactivo.

#### 5.3.2 Implementación
```typescript
// En aiService.ts
async runAudit(track: Track, line: GeometryLine, directives: string) {
  // Procesamiento con IA Gemini 2.0 Flash
  // Identificación matricular y vinculación con RGC
}
```

## 6. Procedimientos de Despliegue
### 6.1 Despliegue Local
1.  Clonar el repositorio.
2.  Ejecutar `npm install`.
3.  Configurar variables de entorno en `.env.local`.
4.  Ejecutar `npm run dev`.

### 6.2 Despliegue en Producción
1.  Compilar la aplicación: `npm run build`.
2.  Servir archivos estáticos desde la carpeta `dist`.
3.  Configurar servidor web (Vercel, GitHub Pages, etc.).

## 7. Configuración de Seguridad
### 7.1 Validación de Contenido
*   Sanitización de entradas de texto.
*   Validación de respuestas de IA mediante esquemas JSON.
*   Protección contra XSS en la visualización de logs.

### 7.2 Gestión de API Keys
*   Uso de variables de entorno seguras.
*   Exclusión de `.env.local` en el control de versiones.

## 8. Monitoreo y Diagnóstico
### 8.1 Logging
*   Sistema de logs de eventos en tiempo real (Neural Core, AI, Error).
*   Registro detallado de telemetría de cada vehículo.

### 8.2 Métricas
*   FPS del sistema (Monitorización de rendimiento).
*   Latencia de detección MediaPipe.

## 9. Consideraciones de Rendimiento
### 9.1 Optimización
*   Procesamiento asíncrono en WebWorkers (MediaPipe).
*   Uso eficiente de canvas para renderizado de alta fidelidad.
*   Gestión de memoria del Tracker (eliminación de tracks obsoletos).

## 10. Pruebas y Validación
### 10.1 Pruebas Unitarias
*   Validación de funciones cinemáticas (Velocidad, Rumbos).
*   Pruebas de intersección de líneas y polígonos.

### 10.2 Pruebas de Integración
*   Flujo completo desde detección hasta reporte IA.

## 11. Mantenimiento y Soporte
### 11.1 Actualizaciones
*   Actualización de modelos MediaPipe (EfficientDet-Lite2).
*   Refinamiento de Prompts de Gemini para mejorar el peritaje.

## 12. Consideraciones Legales y Éticas
### 12.1 Privacidad
*   Gestión de datos según regulaciones locales.
*   Uso de IA para asistencia, con validación humana final necesaria.

### 12.2 Responsabilidad
*   El sistema genera expedientes probatorios sujetos a revisión.

---
*Este documento proporciona una guía completa para la implementación, configuración y mantenimiento del sistema Sentinel AI (v2.0), asegurando una instalación exitosa y operación eficiente del sistema de detección de infracciones de tráfico en Daganzo.*
