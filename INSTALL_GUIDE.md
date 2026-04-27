# 📦 Guía de Instalación - Sentinel AI v1.0.0

## Instalación Rápida

### 1. Descargar instalador
- Descarga `Sentinel AI Setup 0.0.0.exe` desde la carpeta de releases

### 2. Ejecutar instalador
- Haz doble clic en el archivo `.exe`
- Se abrirá el asistente de instalación

### 3. Seguir pasos del asistente
- Siguiente → Siguiente → OK
- Se creará un acceso directo en tu Escritorio

### 4. ¡Listo!
- Haz doble clic en el acceso directo `Sentinel.AI`
- La aplicación se abrirá automáticamente

---

## Requisitos del Sistema

| Requisito | Mínimo | Recomendado |
|-----------|--------|------------|
| **Sistema Operativo** | Windows 10 | Windows 11 |
| **RAM** | 4 GB | 8 GB |
| **Espacio libre** | 2 GB | 5 GB |
| **Procesador** | 2 cores @ 2.0 GHz | 4+ cores @ 2.5 GHz |
| **Conexión** | Internet requerida | Fibra/Cable |

### Nota sobre conectividad
- Se requiere conexión a internet para utilizar Gemini API
- La detección de vehículos funciona offline con YOLOv5m

---

## Primeros Pasos

### 1. Crear cuenta o usar demo
Al abrir la aplicación por primera vez:
- **Opción A**: Crear nueva cuenta con email y contraseña
- **Opción B**: Usar credenciales demo (usuario: demo@sentinel.ai)

### 2. Cargar un video
- Click en "Cargar Video"
- Selecciona un archivo MP4, MOV, AVI, H264 o H265
- Espera a que cargue (2-5 segundos típicamente)

### 3. Crear línea de detección
- En la pantalla de detección, dibuja una línea roja
- Esta es la zona donde se detectarán infracciones

### 4. Iniciar detección
- Click en "Detectar"
- El sistema analizará el video automáticamente
- Los resultados aparecerán en la lista de expedientes

### 5. Ver expedientes
- Click en "Expedientes" (Ctrl+E)
- Verás todas las infracciones detectadas
- Puedes validar, rechazar o generar PDF

---

## Formatos de Video Soportados

✅ **MP4** - H.264, H.265
✅ **MOV** - QuickTime
✅ **AVI** - Audio Video Interleave
✅ **MKV** - Matroska (H.264/H.265)

**Recomendación**: Videos MP4 a 1080p, 30fps, máximo 1 GB

---

## Solución de Problemas

### "La aplicación no inicia"
1. Reinicia tu computadora
2. Desinstala y reinstala la aplicación
3. Verifica que Windows 10+ esté actualizado

### "Error de conexión a Gemini API"
1. Verifica tu conexión a internet
2. Comprueba que el firewall no bloquea la aplicación
3. Intenta de nuevo en 30 segundos

### "Video no carga"
1. Verifica que el archivo sea válido (MP4, MOV, AVI)
2. Intenta con un video de menor tamaño (<500MB)
3. Comprueba que tengas suficiente espacio en disco (2GB mínimo)

### "Bajo rendimiento/lag"
1. Cierra otras aplicaciones
2. Verifica que tengas al menos 4 GB de RAM disponible
3. Reduce la resolución del video

---

## Soporte

- **Documentación**: Ver QUICK_START.md y FAQ.md
- **Versión**: 1.0.0
- **Última actualización**: 2026-04-28
