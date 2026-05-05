# Arquitectura de Seguridad y Cadena de Custodia - Sentinel V16

## 📋 Resumen Ejecutivo

El sistema implementa un modelo de **cadena de custodia forense** completo que garantiza la integridad, trazabilidad y seguridad de todas las infracciones detectadas desde su captura hasta su exportación y archivado.

---

## 🔐 Componentes de Seguridad

### 1. **Cadena de Custodia (Chain of Custody)**

**Archivo**: `services/ChainOfCustodyService.ts`

#### Funcionalidades:
- **Hash SHA-256** de todos los archivos de evidencia (originales y procesados)
- **Manifiestos inmutables** con metadata de cada caso
- **Preservación de integridad**: calcula y valida hashes de:
  - Archivos de video originales
  - Archivos procesados (recortes, extracciones)
  - Reportes finales (PDF)

#### Estructura de datos:
```typescript
CustodyManifest {
  manifestId: string          // ID único del manifiesto
  caseId: string             // ID del caso
  createdAt: ISO 8601 UTC    // Timestamp de creación
  createdBy: string          // Operador que lo creó
  appVersion: string         // Versión de la app
  aiModel: string            // Modelo IA usado
  files: {
    original: EvidenceHash[] // Archivos originales con hashes
    processed: EvidenceHash[]// Archivos procesados con hashes
  }
  reportHash?: string        // Hash del reporte final
  signature?: string         // Firma digital (PHASE 7)
}
```

---

### 2. **Log de Auditoría (Custody Log Service)**

**Archivo**: `services/CustodyLogService.ts`

#### Acciones Registradas:
```
EVIDENCE_CREATED      - Evidencia capturada
EVIDENCE_ACCESSED     - Evidencia consultada
EVIDENCE_DOWNLOADED   - Evidencia descargada
EVIDENCE_DELETED      - Evidencia eliminada
REPORT_GENERATED      - Reporte generado
REPORT_VALIDATED      - Reporte validado
REPORT_REJECTED       - Reporte rechazado
REPORT_SIGNED         - Reporte firmado
REPORT_EXPORTED       - Reporte exportado
REPORT_ARCHIVED       - Reporte archivado
MANIFEST_CREATED      - Manifiesto creado
MANIFEST_VERIFIED     - Integridad verificada
```

#### Datos Capturados por Acción:
```typescript
AuditLogEntry {
  id: UUID                   // ID único del registro
  timestamp: ISO 8601 UTC    // Cuándo ocurrió
  action: CustodyAction      // Qué acción se realizó
  actor: string              // Quién la realizó (operador/sistema)
  entityType: 'CASE' | 'EVIDENCE' | 'REPORT' | 'MANIFEST'
  entityId: string           // ID de la entidad
  metadata: {
    ip?: string              // IP del operador
    userAgent?: string       // Navegador/sistema
    fileSize?: number        // Tamaño del archivo
    fileHash?: string        // SHA-256 del archivo
    resultStatus: 'SUCCESS' | 'FAILURE'
    errorMessage?: string    // Error si ocurrió
    details?: object         // Datos contextuales
  }
}
```

---

### 3. **Validación de Expedientes**

**Archivo**: `domain/Expedient.ts`

#### Estado de Validación:
```typescript
ExpedientValidation {
  isValid: boolean           // ¿Es válida la infracción?
  validatedBy: string        // Operador que validó
  validatedAt: number        // Cuándo validó (UTC timestamp)
  reason?: string            // Motivo de rechazo (si aplica)
  evidenceVerified: boolean  // ¿Se verificó evidencia?
  plateVerified: boolean     // ¿Se verificó placa?
  speedVerified: boolean     // ¿Se verificó velocidad?
  notes?: string             // Notas adicionales
}
```

---

### 4. **Máquina de Estados con Auditoría**

**Archivo**: `domain/ExpedientStateMachine.ts`

#### Estados Permitidos:
```
DETECTED          → Auto-detección por IA
  ↓
UNDER_REVIEW      → Revisión manual de operador
  ↓
VALIDATED         → Aprobado por operador
  ↓
SIGNED            → Firmado digitalmente
  ↓
EXPORTED          → Exportado como reporte oficial
  ↓
ARCHIVED          → Archivado (fin de ciclo de vida)
```

#### Historial de Transiciones:
```typescript
ExpedientStateTransition {
  from: ExpedientState       // Estado anterior
  to: ExpedientState         // Estado nuevo
  actor: string              // Quién hizo la transición
  timestamp: number          // Cuándo (UTC)
  reason?: string            // Motivo de la transición
  signature?: string         // Hash de firma (para SIGNED)
  notes?: string             // Notas adicionales
}
```

---

### 5. **Firma Digital y Certificados**

**Archivo**: `services/SignatureService.ts`

#### Estructura:
```typescript
ExpedientSignature {
  isSigned: boolean          // ¿Está firmado?
  signedBy: string           // Quién lo firmó
  signedAt: number           // Cuándo (UTC timestamp)
  signatureHash: string      // SHA-256 del contenido firmado
  certFingerprint?: string   // Huella del certificado digital
  method: 'manual' | 'digital' | 'biometric'
}
```

---

### 6. **Verificación de Integridad (Custody Verification)**

**En**: `domain/Expedient.ts`

#### Datos de Verificación:
```typescript
ExpedientCustodyRow {
  fileName: string           // Nombre del archivo
  kind: 'ORIGINAL' | 'PROCESADA' | 'REPORTE'
  expectedHash: string       // Hash esperado
  calculatedHash: string     // Hash calculado
  isValid: boolean           // ¿Coinciden los hashes?
  checkedAt: string          // ISO 8601 de verificación
  note?: string              // Anotaciones
}
```

Almacenado en:
```typescript
Expedient {
  custodyLastCheckedAt?: number           // Cuándo se verificó
  custodyLastStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING'
  custodyLastSummary?: string             // Resumen de verificación
  custodyVerificationRows?: ExpedientCustodyRow[]
}
```

---

## 🔄 Flujo Completo de una Infracción

```
1. DETECCIÓN (Buffer de Forensic Queue)
   ├─ Se detecta infracción por IA
   ├─ Se captura evidencia (video, fotos)
   ├─ Se calculan hashes SHA-256
   └─ Se crea AuditLog: EVIDENCE_CREATED

2. REGISTRO EN BASE DE DATOS
   ├─ Se guarda en tabla "infractions"
   ├─ Se vincula con tabla "expedients"
   ├─ Se almacena manifiesto de custodia
   └─ Se registra en log de auditoría

3. REVISIÓN MANUAL (UNDER_REVIEW)
   ├─ Operador revisa evidencia
   ├─ Se registra operador en audit_log
   ├─ Estado transiciona → UNDER_REVIEW
   └─ Se crea StateTransition en stateHistory

4. VALIDACIÓN (VALIDATED)
   ├─ Operador valida:
   │  ├─ Evidencia
   │  ├─ Placa (OCR)
   │  └─ Velocidad (si aplica)
   ├─ Se registra validación
   ├─ Se guarda validatedBy, validatedAt
   └─ Estado transiciona → VALIDATED

5. FIRMA DIGITAL (SIGNED)
   ├─ Se calcula hash del reporte
   ├─ Supervisor firma digitalmente
   ├─ Se almacena signatureHash
   └─ Estado transiciona → SIGNED

6. EXPORTACIÓN (EXPORTED)
   ├─ Se genera reporte oficial (PDF)
   ├─ Se calcula hash del PDF
   ├─ Se verifica integridad
   ├─ Se registra acción REPORT_EXPORTED
   └─ Estado transiciona → EXPORTED

7. VERIFICACIÓN FINAL
   ├─ Validación de hashes
   ├─ Verificación de cadena de custodia
   ├─ Confirmación de firmas
   └─ Se registra: MANIFEST_VERIFIED

8. ARCHIVADO (ARCHIVED)
   ├─ Se programa eliminación automática
   ├─ Según DPIA y retención
   └─ Estado transiciona → ARCHIVED
```

---

## 📊 Tabla de Relaciones de Datos

| Tabla | Campo Custodia | Campo Auditoría | Campo Validación | Campo Firma |
|-------|--------|---------|-----------|-----------|
| **infractions** | — | — | validation_status | — |
| **expedients** | custody_last_* | audit_log, state_history | validation | signature_* |
| **audit_logs** (potencial) | entity_id, fileHash | action, actor, timestamp | resultStatus | — |

---

## 🔍 Datos Visibles en la Tabla de Infracciones

La tabla mejorada ahora muestra:

### Columnas Principales:
1. Placa
2. Vehículo (marca/modelo)
3. Infracción (categoría)
4. Gravedad (color codificada)
5. Hora
6. Validación (estado)
7. Multa

### Detalles Expandibles (📂):

#### Datos Generales
- Descripción
- Hora local
- Código de video
- Base legal
- Color del vehículo
- Puntos deducidos

#### Validación & Seguridad
- 👤 Operador
- 👔 Supervisor
- 🔐 Firmado por (con nombre)
- ✅ DPIA Certificado

#### Cadena de Custodia
- 🕐 Fecha/hora de verificación
- 📊 Estado (SUCCESS/FAILURE/PENDING)
- 📝 Resumen
- 📁 Archivos verificados (con estado individual)

#### Historial de Estado
- Transiciones: DETECTED → UNDER_REVIEW → VALIDATED → SIGNED → EXPORTED
- Quién realizó cada transición
- Cuándo ocurrió

#### Log de Auditoría
- Últimas acciones registradas
- Quién realizó cada acción
- Timestamp exacto
- Mostradas en orden cronológico (últimas 5, con contador de más)

#### Información Técnica
- ID único de infracción
- Hash de firma digital (si existe)

---

## 🛡️ Medidas de Seguridad Implementadas

1. **Integridad de Datos**
   - SHA-256 hashing en todos los archivos
   - Validación de hashes en cada acceso
   - Detección automática de manipulación

2. **Trazabilidad Completa**
   - Cada acción registrada con actor y timestamp
   - Imposible eliminar o modificar logs
   - Auditoría inmutable

3. **Control de Acceso**
   - Roles: OPERATOR, SUPERVISOR, ADMIN
   - Cada acción vinculada a usuario
   - Validaciones antes de transiciones

4. **Certificación Legal**
   - Firma digital con certificados
   - Huellas digitales de certificados
   - Validación forense para juicio

5. **Cumplimiento de Regulaciones**
   - DPIA (Data Protection Impact Assessment)
   - Retención automática de datos
   - Eliminación programada

---

## 🔗 Referencias en el Código

### Servicios
- `services/ChainOfCustodyService.ts` - Gestión de hashes y manifiestos
- `services/CustodyLogService.ts` - Logs de auditoría
- `services/SignatureService.ts` - Firmas digitales
- `services/ExpedientRepository.ts` - Persistencia en Supabase

### Dominios
- `domain/Expedient.ts` - Entidad principal con todos los campos
- `domain/ExpedientStateMachine.ts` - Máquina de estados y transiciones

### Componentes UI
- `components/InfractionsTable.tsx` - Tabla mejorada con datos de custodia
- `pages/ExpedientListPage.tsx` - Página principal de expedientes

---

## 📈 Próximas Mejoras (PHASE 8+)

- [ ] Blockchain para inmutabilidad de logs
- [ ] Notarización pública de manifiestos
- [ ] Dashboard de compliance automático
- [ ] Alertas en tiempo real de anomalías
- [ ] Exportación de certificados forenses
- [ ] Integración con sistemas judiciales

---

**Documento generado**: 2026-05-04
**Versión**: Sentinel V16 - PHASE 7
**Responsable**: Sistema de Auditoría Forense
