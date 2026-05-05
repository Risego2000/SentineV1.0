# 📊 Guía de Uso - Tabla de Infracciones Mejorada

## 🎯 ¿Qué es?

Un módulo completo que muestra **TODAS las infracciones detectadas con TODOS sus datos**, incluyendo:
- ✅ Datos básicos de la infracción
- ✅ Cadena de custodia forense (hashes, verificaciones)
- ✅ Auditoría completa (quién hizo qué, cuándo)
- ✅ Validaciones (placa, evidencia, velocidad)
- ✅ Firmas digitales
- ✅ Historial de cambios de estado
- ✅ Cumplimiento legal (DPIA, retención)

---

## 🚀 Cómo Acceder

1. **Abre la pantalla de Expedientes**
   - Desde el Módulo de Detección, presiona `Ctrl+E`
   - O haz clic en "MÓDULO DE DETECCIÓN" → cambiar vista

2. **Sin expediente seleccionado**
   - Si NO has seleccionado ningún expediente en la lista izquierda
   - La tabla de infracciones aparecerá automáticamente en el panel derecho

3. **La tabla se carga automáticamente**
   - Obtiene datos de la tabla `infractions`
   - Enriquece con datos de custodia de tabla `expedients`
   - Fallback a tabla `incidents` si no hay permisos

---

## 📋 Columnas Principales

| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| **Placa** | Matrícula del vehículo (OCR) | ✅ Sí |
| **Vehículo** | Marca y modelo | ✅ Sí |
| **Infracción** | Categoría/tipo de infracción | ✅ Sí |
| **Gravedad** | CRÍTICA / ALTA / MEDIA / BAJA | ✅ Sí |
| **Hora** | Fecha y hora de detección | ✅ Sí |
| **Validación** | Estado (PENDING / VALIDATED / REJECTED) | ✅ Sí |
| **Multa (€)** | Cantidad en euros | ✅ Sí |
| **⋯** | Expandir detalles | — |

---

## 🔍 Cómo Expandir Detalles

1. **Haz clic en el botón "⋯"** en cualquier fila
2. La fila se expande mostrando TODOS los datos
3. Haz clic nuevamente para colapsar

---

## 📂 Detalles Completos (Cuando Expandas)

### 📋 **Datos Generales**
```
Descripción:        "Cruzó línea de semáforo en rojo"
Hora Local:         "2026-05-04 14:32:15"
Código Video:       "14:32:15.123"
Base Legal:         "Art. 67 LTSV"
Color Vehículo:     "Negro"
Puntos Deducidos:   -3
```

### 🔐 **Validación & Seguridad**
```
👤 Operador:            "rserrano2000@gmail.com"
👔 Supervisor:          "supervisor_1@example.com"
🔐 Firmado por:         "Digital - 2026-05-04 15:45:00"
✅ DPIA Certificado:    ✓ Sí
```

### 🔒 **Cadena de Custodia**
```
🕐 Verificada:          "2026-05-04 15:00:00"
📊 Estado:              SUCCESS ✓
📝 Resumen:             "3/3 archivos verificados correctamente"

Archivos verificados:
  ✓ video_original.mp4          [ORIGINAL]
  ✓ infraction_clip_8s.mp4      [PROCESADA]
  ✓ report_signed.pdf           [REPORTE]
```

### 📝 **Historial de Estado**
```
DETECTED → UNDER_REVIEW       | Operador: juan_lopez | 2026-05-04 14:35:00
UNDER_REVIEW → VALIDATED      | Operador: juan_lopez | 2026-05-04 14:40:00
VALIDATED → SIGNED            | Supervisor: admin    | 2026-05-04 15:00:00
SIGNED → EXPORTED             | Sistema              | 2026-05-04 15:10:00
```

### 📊 **Log de Auditoría**
```
[EVIDENCE_CREATED]     sistema              14:32:15
[REPORT_GENERATED]     juan_lopez           14:35:20
[REPORT_VALIDATED]     juan_lopez           14:40:15
[REPORT_SIGNED]        admin                15:00:30
[REPORT_EXPORTED]      sistema              15:10:45
... y 12 más
```

### 🔑 **Información Técnica**
```
ID Infracción:         "inf_2026050414321234"
Hash Firma:            "a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5"
```

---

## ⚙️ Funcionalidades

### 🔄 **Ordenamiento**
- Click en cualquier encabezado de columna
- Cambia dirección (↑ ascendente / ↓ descendente)
- Indicador visual muestra columna ordenada

### 🔃 **Actualización Manual**
- Botón "🔄" en la esquina superior derecha
- Recarga datos desde Supabase
- Spinner indica que está cargando

### ⚠️ **Manejo de Errores**
- Si falla conexión a `infractions`: intenta `incidents`
- Si falla ambas: muestra error "Sin permisos" con explicación
- Mensaje de error es informativo para contactar admin

### 📊 **Contador de Registros**
- Muestra en header: "200 registros"
- Se actualiza al recargar

---

## 🔐 Datos de Seguridad Explicados

### **¿Qué es la Cadena de Custodia?**
Registro inmutable que prueba que:
- La evidencia no ha sido modificada
- Cada archivo tiene un hash SHA-256 único
- Se verifican los hashes en cada acceso

### **¿Qué es el Log de Auditoría?**
Registro completo de:
- Quién: Operador/sistema que realizó la acción
- Qué: Tipo de acción (creación, validación, firma)
- Cuándo: Timestamp exacto en UTC
- Dónde: IP, navegador (en metadatos)

### **¿Qué es la Validación?**
Confirmación manual de:
- ✓ Evidencia: ¿Es válida la evidencia?
- ✓ Placa: ¿Es correcta la placa detectada por OCR?
- ✓ Velocidad: ¿Es correcta la velocidad detectada?

### **¿Qué es la Firma Digital?**
Certificado legal que prueba:
- Quién firmó el documento
- Cuándo fue firmado
- Que no ha sido modificado desde la firma (hash)

---

## 💡 Casos de Uso

### **Caso 1: Revisar todas las infracciones pendientes**
1. Abre Expedientes (Ctrl+E)
2. No selecciones ninguna en la izquierda
3. Ve la tabla completa en el panel derecho
4. Expande cada una para ver si está lista para validar

### **Caso 2: Buscar una infracción específica**
1. Ordena por Placa (click en encabezado)
2. Busca visualmente o expande para ver detalles
3. Verifica el historial de estado

### **Caso 3: Auditar una infracción**
1. Expande la fila
2. Revisa el Log de Auditoría completo
3. Verifica la Cadena de Custodia (¿todos los hashes correctos?)
4. Comprueba firmas digitales

### **Caso 4: Entender por qué fue rechazada**
1. Expande la fila rechazada
2. Revisa el Historial de Estado (razón)
3. Mira el Log de Auditoría
4. Verifica quién la rechazó y cuándo

---

## 🛠️ Problemas Comunes

### ❌ "No hay infracciones detectadas"
- **Causa**: No hay datos en las tablas
- **Solución**: Asegúrate de que hay videos procesados en el Módulo de Detección

### ❌ "No se pueden cargar las infracciones"
- **Causa**: Permisos insuficientes en Supabase (RLS policies)
- **Solución**: Contacta al admin para habilitar permisos en `infractions` o `incidents`

### ❌ Datos incompletos en detalles
- **Causa**: Expediente sin datos de custodia vinculado
- **Solución**: Normal - algunos campos son opcionales. Se muestran como "—"

### ⚠️ Hash no valida
- **Causa**: Archivo fue modificado después de la captura
- **Solución**: ¡ALARMA DE SEGURIDAD! - Contacta a supervisión inmediatamente

---

## 📱 Responsive Design

La tabla se adapta a diferentes tamaños:
- **Desktop (1920px+)**: Todas las columnas visibles
- **Laptop (1440px)**: Scroll horizontal si es necesario
- **Tablet**: Columnas prioritarias, expandible para detalles

---

## 🔗 Integración con Expedientes

### Cuando EXPANDES un expediente:
- La tabla desaparece
- Ves el flujo completo de validación/firma

### Cuando CIERRAS (no seleccionar):
- Aparece nuevamente la tabla
- Puedes ver todas las infracciones

---

## 📊 Datos Que Provienen De

| Dato | Tabla | Campo |
|------|-------|-------|
| Placa, Vehículo | infractions | plate, make_model |
| Custodia, Auditoría | expedients | custody_*, audit_log |
| Validación | expedients | validation |
| Firma Digital | expedients | signature_* |
| Historial | expedients | state_history |

---

## 🚀 Próximas Mejoras (Propuestas)

- [ ] Búsqueda por texto (placa, descripción)
- [ ] Filtros por fecha, gravedad, estado
- [ ] Exportar a Excel con todos los datos
- [ ] Gráficas de estadísticas
- [ ] Alertas en tiempo real de nuevas infracciones
- [ ] Comparación de hashes en tiempo real
- [ ] Dashboard de cumplimiento legal

---

**Versión**: 1.0  
**Fecha**: 2026-05-04  
**Componente**: `components/InfractionsTable.tsx`  
**Integrado en**: `pages/ExpedientListPage.tsx`
