# SentinelV16 Electron - Lista de Verificación de Despliegue

## Pre-Despliegue (FASE 6)

### 1. Validación del Entorno
- [ ] Ejecuta: `npm run test:electron`
- [ ] Todas las pruebas deberían pasar excepto FFmpeg/Python (si no están instalados)
- [ ] Sin errores críticos en los logs

### 2. Validación de Recursos
```bash
# Verifica si los recursos están presentes
if exist resources\ffmpeg\ffmpeg.exe echo "FFmpeg OK" else echo "FFmpeg FALTA"
if exist resources\python\python.exe echo "Python OK" else echo "Python FALTA"
```

- [ ] FFmpeg existe en: `resources/ffmpeg/ffmpeg.exe`
- [ ] Python existe en: `resources/python/python.exe`
- [ ] PaddleOCR instalado: `resources/python/Lib/site-packages/paddleocr/`

### 3. Verificación de Compilación
```bash
npm run build:electron
```

- [ ] Sin errores TypeScript
- [ ] `dist/electron/main.js` existe y es válido
- [ ] `dist/electron/preload.js` existe y es válido

### 4. Prueba de Desarrollo
```bash
npm run electron
```

**En la aplicación en ejecución:**
- [ ] La ventana se abre sin congelarse
- [ ] Los componentes React cargan visiblemente
- [ ] La consola (F12) no tiene errores rojos
- [ ] Puedes interactuar con la UI (botones, entradas)
- [ ] Los controles de ventana funcionan (minimizar, maximizar, cerrar)

### 5. Pruebas Funcionales

#### 5.1 Carga de Video y Detección
```
Esperado: La aplicación maneja la carga de video, lo muestra en el visor
- [ ] Haz clic en el botón de carga o arrastra un video
- [ ] El video aparece en la vista previa
- [ ] MediaPipe se ejecuta (puede tomar 5-10 seg en la primera ejecución)
- [ ] Los cuadros delimitadores verdes aparecen alrededor de los vehículos
- [ ] Los cuadros rastrean vehículos mientras el video se reproduce
```

#### 5.2 Extracción de Fotogramas
```
Esperado: Fotogramas extraídos en resolución 2688x1520
- [ ] Video procesado fotograma por fotograma
- [ ] Sin errores de consola sobre extracción
- [ ] Desempeño aceptable (<100ms por fotograma)
```

#### 5.3 Funcionalidad OCR
```
Esperado: La extracción de placas funciona vía IPC
- [ ] Vehículo con placa visible en fotograma
- [ ] La consola muestra: "[IPC] ocr:extractPlate called"
- [ ] Placa extraída correctamente (formato español: 1234ABC)
- [ ] Sin errores HTTP 404 en la consola
- [ ] Se completa en <1000ms
```

#### 5.4 Análisis de IA
```
Esperado: El análisis de geometría y auditoría funciona
- [ ] Crear línea de tráfico (creación de geometría)
- [ ] Cruce de vehículo detectado
- [ ] La consola muestra: "[IPC] api:ai:geometry called"
- [ ] La consola muestra: "[IPC] api:ai:audit called"
- [ ] Tipo de infracción detectado (GIRO_PROHIBIDO, etc.)
- [ ] Resultado guardado en la base de datos
```

#### 5.5 Generación de PDF
```
Esperado: Se genera Boletín de denuncia y se descarga
- [ ] Haz clic en "Generar Informe" o equivalente
- [ ] Se descarga PDF (verifica la carpeta Descargas)
- [ ] PDF se abre correctamente en el lector
- [ ] Contiene: Placa, timestamp, tipo de violación, ubicación
- [ ] El texto en español se renderiza correctamente
```

#### 5.6 Gestión de Sesiones
```
Esperado: Múltiples sesiones funcionan sin conflictos
- [ ] Carga y analiza video A
- [ ] Carga video B sin cerrar A
- [ ] Ambas sesiones son independientes
- [ ] Cambia entre sesiones
- [ ] Sin fuga de memoria (Administrador de tareas: <500MB)
```

### 6. Puntos de Referencia de Desempeño

Ejecuta mientras la aplicación está activa:

```
Métrica              | Objetivo  | Real   | Pasó
--------------------|-----------|--------|------
Memoria en 5 min    | <300 MB   | _____  | [ ]
Memoria en 30 min   | <500 MB   | _____  | [ ]
Promedio CPU        | <20%      | _____  | [ ]
Tasa de fotogramas  | 30 FPS    | _____  | [ ]
OCR por imagen      | <1000ms   | _____  | [ ]
Análisis de IA      | <2000ms   | _____  | [ ]
Conteo de fallos    | 0         | _____  | [ ]
```

### 7. Compilación de Producción

```bash
npm run build
```

- [ ] Compilación completada sin errores
- [ ] `build/SentinelV16-Setup.exe` creado
- [ ] Tamaño de archivo razonable (~400-500 MB)
- [ ] Sin advertencias sobre recursos faltantes

### 8. Pruebas de Instalador (Final)

**En una VM limpia de Windows o computadora separada:**

1. **Instalación**
   ```
   [ ] Haz doble clic en SentinelV16-Setup.exe
   [ ] El instalador comienza
   [ ] Aparece pantalla de licencia (si está configurada)
   [ ] Aparece diálogo de ruta de instalación
   [ ] La instalación se completa sin errores
   [ ] Se crea acceso directo de escritorio
   [ ] Se crea acceso directo del menú Inicio
   ```

2. **Lanzamiento**
   ```
   [ ] Haz clic en el acceso directo del escritorio
   [ ] La aplicación se inicia en 3 segundos
   [ ] La ventana aparece completamente renderizada
   [ ] Sin congelación de pantalla de presentación
   [ ] La aplicación React carga visiblemente
   ```

3. **Flujo de Trabajo Completo**
   ```
   [ ] Todas las pruebas funcionales pasan (5.1-5.6)
   [ ] Sin errores de dependencias
   [ ] Sin errores de "DLL faltante"
   [ ] Desempeño aceptable
   ```

4. **Desinstalación**
   ```
   [ ] Panel de Control → Programas → Desinstalar
   [ ] SentinelV16 aparece en la lista
   [ ] Desinstalación se completa limpiamente
   [ ] Se eliminan accesos directos
   [ ] Sin archivos residuales en Archivos de Programa
   ```

### 9. Pruebas de Regresión

Verifica que no hay regresiones de la versión web:

- [ ] Procesamiento de video idéntico a versión web
- [ ] Precisión de OCR igual o mejor
- [ ] Detección de infracciones coincide con versión web
- [ ] Salida PDF idéntica
- [ ] Almacenamiento en base de datos funciona
- [ ] Autenticación de Supabase funciona (si está configurada)

### 10. Verificación de Documentación

- [ ] README_ELECTRON.md es preciso
- [ ] QUICK_START.md refleja los pasos reales
- [ ] La sección de solución de problemas cubre los problemas encontrados
- [ ] Requisitos del sistema documentados
- [ ] Limitaciones conocidas documentadas

## Autorización

**Listo para Despliegue:** [ ] SÍ / [ ] NO

**Bloqueadores Encontrados:**
```
1. ____________________
2. ____________________
3. ____________________
```

**Notas:**
```
____________________
____________________
____________________
```

**Probado Por:** _______________
**Fecha:** _______________
**Versión de Compilación:** _______________

## Post-Despliegue

### Monitoreo
- [ ] Monitorea retroalimentación de usuarios
- [ ] Verifica informes de fallos (si la telemetría está habilitada)
- [ ] Monitorea métricas de desempeño
- [ ] Registra errores de usuarios

### Protocolo de Corrección Rápida
Si se encuentran problemas:
1. Identifica la causa raíz
2. Corrije en el código fuente
3. Ejecuta: `npm run build`
4. Lanza nueva versión
5. Notifica a los usuarios

### Analítica
- [ ] Rastrear uso de características
- [ ] Monitorear métricas de desempeño
- [ ] Recopilar retroalimentación de usuarios
- [ ] Planificar próximo lanzamiento

---

**Versión:** 1.0
**Última Actualización:** 2026-04-25
**Estado:** Listo para despliegue
