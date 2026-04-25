# ✓ FFmpeg Instalado - Siguientes Pasos para Python

## Estado Actual

```
✓ FASE 1-4: Implementación Electron - COMPLETADA
✓ FASE 5a: Descarga FFmpeg - COMPLETADA (150 MB instalado)
⏳ FASE 5b: Descarga Python - PASO MANUAL REQUERIDO
⏳ FASE 5c: Configuración PaddleOCR - AUTO (después de Python)
⏳ FASE 6: Testing & validación - LISTA
```

---

## Inicio Rápido (Elige Una Opción)

### Opción 1: Descarga + Instalación Automática (Recomendada)

```bash
# Solo funciona si python.org es accesible desde tu red
npm run download:python
npm run install:paddleocr
npm run test:electron
npm run electron
```

**Estado**: ⚠️ python.org puede estar bloqueado o las URLs pueden haber cambiado
**Si esto falla**, procede a la Opción 2

---

### Opción 2: Descarga Manual (Más Confiable)

1. **Descargar Python**
   - Visita: https://www.python.org/downloads/windows/
   - Encuentra la sección "Python 3.10.x"
   - Descarga: `Windows embeddable package (64-bit)` 
   - Debe ser ~50-60 MB

2. **Extraer Python**
   ```bash
   # Crear carpeta
   mkdir resources\python
   
   # Extrae el zip descargado en resources\python\
   # Deberías ver python.exe en: resources\python\python.exe
   ```

3. **Instalar PaddleOCR**
   ```bash
   resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
   ```
   
   ⏱️ Esto toma 10-15 minutos (descarga ~200 MB de archivos de modelos)

4. **Verificar Todo**
   ```bash
   npm run test:electron
   ```

5. **Ejecutar la Aplicación**
   ```bash
   npm run electron
   ```

---

### Opción 3: Fuente Alternativa de Python

Si python.org no es accesible:

1. Ve a: https://github.com/indygreg/python-build-standalone/releases
2. Encuentra la última versión "cpython-3.10.x" (64-bit Windows)
3. Descarga la variante "_install_only"
4. Extrae a `resources\python\`

---

## Guía Paso a Paso Detallada

Ve a: **setup-manual.md** para instrucciones detalladas

---

## Qué Hace Cada Paso

| Paso | Acción | Tiempo | Resultado |
|------|--------|--------|-----------|
| 1 | Descargar Python 3.10 | 5 min | `python.exe` en `resources/python/` |
| 2 | Extraer a carpeta | 1 min | Carpeta con archivos de Python |
| 3 | Instalar PaddleOCR | 10-15 min | PaddleOCR + modelos instalados |
| 4 | Probar todo | 2 min | 19/19 pruebas pasando |
| 5 | Ejecutar aplicación | - | Aplicación Electron se abre |
| 6 | Compilar instalador | 5 min | `build/SentinelV16-Setup.exe` |

**Tiempo Total**: ~30-45 minutos

---

## Verificación en Cada Paso

### Después de Descargar Python
```bash
resources\python\python.exe --version
# Esperado: Python 3.10.x
```

### Después de Instalar PaddleOCR
```bash
resources\python\python.exe -c "import paddleocr; print('PaddleOCR instalado')"
# Esperado: PaddleOCR instalado
```

### Después de Todo
```bash
npm run test:electron
# Esperado: ✓ Las 19 pruebas pasando
```

---

## Solución de Problemas

### "No se puede descargar Python" (Opción 1 falló)
→ Usa la Opción 2 (Manual) u Opción 3 (Fuente alternativa)

### "Python no encontrado" después de extraer
→ Verifica: `resources\python\python.exe` existe
→ Si falta, extrae el zip de Python nuevamente con cuidado

### "La instalación de PaddleOCR falla"
→ Asegúrate de que Python está en `resources\python\`
→ Verifica la conexión de red (descarga ~200 MB)
→ Si pip se agota el tiempo, intenta: 
```bash
resources\python\python.exe -m pip install --index-url https://pypi.org/simple/ paddleocr
```

### "test:electron sigue mostrando Python faltante"
→ Ejecuta: `npm run test:electron` nuevamente
→ Si aún falla, verifica que `resources\python\python.exe` existe

---

## Una Vez Que Todo Esté Listo

```bash
# Prueba que la aplicación funciona
npm run test:electron

# Ejecuta en modo desarrollo
npm run electron

# Compila instalador de producción
npm run build

# Salida: build/SentinelV16-Setup.exe (¡listo para distribuir!)
```

---

## Resumen

¡Ya estás al 95%! ✓

**Solo necesitas:**
1. ⏳ Descargar Python (5-10 min)
2. ⏳ Instalar PaddleOCR (10-15 min)
3. ✓ ¡Todo lo demás está listo!

Entonces puedes probar la aplicación completa y compilar el instalador para distribución.

---

**Sigue**: setup-manual.md para una guía paso a paso detallada
