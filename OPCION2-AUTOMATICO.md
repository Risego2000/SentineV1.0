# Opción 2 - Semi-Automática (Recomendada)

## Paso 1: Descargar Python (Manual - 3 minutos)

### En tu navegador:
1. Abre: https://www.python.org/downloads/windows/
2. Busca: **"Python 3.10"** o la versión más reciente 3.10.x
3. Descarga: **"Windows embeddable package (64-bit)"**
   - Debe terminar en: `python-3.10.x-embed-amd64.zip`
   - Tamaño: ~50 MB
4. Guarda en: **Carpeta Descargas** (por defecto)

### Espera a que termine la descarga (2-3 minutos)

---

## Paso 2: Ejecutar Script Automático (Automático - 15 minutos)

Una vez que el ZIP esté descargado en tu carpeta Descargas, ejecuta:

```bash
# En PowerShell o CMD en la carpeta del proyecto
.\setup-python-manual.bat
```

**¿Qué hace?**
1. ✓ Verifica si Python ya existe
2. ✓ Busca el ZIP en tu carpeta Descargas
3. ✓ Lo extrae automáticamente a `resources/python/`
4. ✓ Instala PaddleOCR automáticamente (descarga ~200 MB de modelos)
5. ✓ Muestra instrucciones finales

---

## Paso 3: Verificar Instalación (Automático - 2 minutos)

Una vez que el script termine:

```bash
npm run test:electron
```

Debería mostrar:
```
✓ FFmpeg found
✓ Python found
✓ PaddleOCR installed
✓ All tests passed (19/19)
```

---

## Paso 4: Lanzar la Aplicación

```bash
npm run electron
```

¡La aplicación Electron se abrirá con la interfaz React!

---

## Si Falla la Descarga de Python

**Alternativa 1: Desde GitHub (Más confiable)**
```
1. Ve a: https://github.com/indygreg/python-build-standalone/releases
2. Busca la última versión con "cpython-3.10"
3. Descarga: cpython-3.10.x-x86_64-pc-windows-msvc-install_only.zip
4. Guarda en: Carpeta Descargas
5. Ejecuta nuevamente: .\setup-python-manual.bat
```

**Alternativa 2: Manual Completo**
Ver: `setup-manual.md`

---

## Resumen de Tiempo Total

| Paso | Acción | Tiempo | Automático |
|------|--------|--------|-----------|
| 1 | Descargar Python | 3 min | ✓ Parcial (descarga manual) |
| 2 | Ejecutar script | 15 min | ✓ Automático |
| 3 | Verificar tests | 2 min | ✓ Automático |
| 4 | Lanzar app | - | ✓ Automático |
| **Total** | | **20 min** | **95% automático** |

---

## Comandos Útiles

```bash
# Ejecutar solo el script Python + PaddleOCR
.\setup-python-manual.bat

# Verificar que todo está instalado
npm run test:electron

# Lanzar en modo desarrollo
npm run electron

# Compilar para producción (después de todo)
npm run build
```

---

**¡Esto es lo máximo automático posible sin poder descargar desde python.org!**

Una vez que descargues el ZIP manualmente, todo lo demás se automatiza.
