# 🚀 Quick Start - Sentinel AI v1.0.0

## Inicio Rápido (5 minutos)

### 1️⃣ Abrir la aplicación
```
Doble-click en el acceso directo "Sentinel.AI" en tu Escritorio
```

### 2️⃣ Login
- **Email**: demo@sentinel.ai (o tu email)
- **Contraseña**: demo (o tu contraseña)
- Click "Entrar"

---

## 📹 Modo Detección (Análisis de Videos)

### Paso a paso:

1. **Cargar video**
   - Click botón "📁 Cargar Video"
   - Selecciona un archivo MP4/MOV/AVI
   - Espera que aparezca en la pantalla

2. **Dibujar línea de detección**
   - Click y arrastra para dibujar una línea roja
   - Esta línea define la zona monitoreada
   - Ejemplo: cruce de calle, semáforo, giro prohibido

3. **Configurar parámetros (opcional)**
   ```
   - Velocidad máxima: 60 km/h
   - Modo: Detección automática
   - Confianza mínima: 85%
   ```

4. **Iniciar análisis**
   - Click "▶️ Detectar"
   - El sistema procesará el video
   - Barra de progreso indicará estado (0-100%)

5. **Ver resultados**
   - Se detectarán automáticamente:
     - ✅ Rebase de línea
     - ✅ Giro prohibido
     - ✅ Exceso de velocidad
   - Aparecerán en la lista con:
     - Placa extraída (OCR)
     - Tipo de infracción
     - Timestamp del evento
     - Video de la infracción

---

## 📋 Modo Expedientes (Validación & Firma)

### Cambiar a Expedientes:
```
Click en pestaña "Expedientes" o presiona Ctrl+E
```

### Flujo de validación:

```
DETECTED (Detectado por IA)
    ↓
    → Click "Validar" → VALIDATED (Validado por operador)
    → Click "Rechazar" → REJECTED (Rechazado)
```

### Validar infracción:

1. **Seleccionar expediente** de la lista
2. **Revisar detalles**:
   - Placa del vehículo
   - Tipo de infracción
   - Velocidad/ángulo
   - Video de prueba
3. **Decidir**:
   - ✅ **Validar**: Infracción confirmada
   - ❌ **Rechazar**: Falso positivo

### Después de validar:

4. **Firmar digitalmente** (si necesario)
   - Click "🔐 Firmar"
   - Ingresa PIN o biometría
   - Estado cambia a SIGNED

5. **Exportar PDF**
   - Click "📄 Generar PDF"
   - Se crea PDF oficial con:
     - Datos del vehículo
     - Foto infracción
     - Firma digital
     - Audit trail completo

---

## 💾 Gestión de Datos

### Ver expedientes guardados:
```
Expedientes → Filtros:
- Por estado (DETECTED, VALIDATED, SIGNED, EXPORTED)
- Por placa (búsqueda)
- Por fecha
```

### Exportar múltiples:
```
1. Seleccionar varios expedientes (checkbox)
2. Click "📊 Exportar Excel"
3. Se genera archivo con todos los datos
```

---

## ⌨️ Atajos de Teclado

| Atajo | Función |
|-------|---------|
| **Ctrl+E** | Cambiar a Expedientes |
| **Ctrl+V** | Cargar Video |
| **Ctrl+D** | Iniciar Detección |
| **Ctrl+S** | Guardar/Exportar |
| **Ctrl+P** | Generar PDF |
| **Escape** | Cancelar acción |

---

## 🔧 Configuración Recomendada

### Para máxima precisión:
```json
{
  "velocidad_maxima": 60,
  "confianza_minima": 0.90,
  "modo_deteccion": "strict",
  "almacenamiento": "cloud"
}
```

### Para máxima velocidad:
```json
{
  "velocidad_maxima": 60,
  "confianza_minima": 0.75,
  "modo_deteccion": "auto",
  "almacenamiento": "local"
}
```

---

## 🎯 Casos de Uso Típicos

### Caso 1: Control de tráfico en semáforo
1. Cargar video del semáforo
2. Dibujar línea en cruce
3. Detectar rebase sin detenerse
4. Validar y generar PDF

### Caso 2: Giro prohibido
1. Cargar video de intersección
2. Dibujar línea en entrada a calle
3. Detectar giro hacia dirección prohibida
4. Comparar con expedientes anteriores

### Caso 3: Exceso de velocidad
1. Cargar video de calle
2. Calibrar puntos de referencia
3. Medir velocidad de vehículos
4. Detectar exceso y generar infracción

---

## 📞 Ayuda Rápida

**¿Cómo calibro la velocidad?**
- Ver sección "Calibración" en Configuración
- Necesitas 2+ puntos de referencia conocidos
- Sistema calcula automáticamente km/h

**¿Dónde se guardan los datos?**
- Cloud: Supabase (automático, encriptado)
- Local: Caché de navegador para offline

**¿Puedo editar expedientes después?**
- Sí, mientras no estén EXPORTED
- Cambios se registran en audit trail

**¿Cómo exporto los datos?**
- PDF individual: Click en expediente → "Generar PDF"
- Excel masivo: Seleccionar varios → "Exportar Excel"

---

**Versión**: 1.0.0  
**Última actualización**: 2026-04-28  
**Siguiente paso**: Ver FAQ.md para preguntas frecuentes
