/**
 * Expedient Domain - PHASE 7
 * Legal case/file entity for managing infractions from detection to closure
 * Tracks state, approvals, and audit trail
 */

export type ExpedientState =
  | 'DETECTED'        // Infracción detectada automáticamente
  | 'UNDER_REVIEW'    // Esperando revisión de operador
  | 'VALIDATED'       // Aprobado por operador (listo para firma)
  | 'REJECTED'        // Rechazado por operador (no procede)
  | 'SIGNED'          // Firmado digitalmente
  | 'EXPORTED'        // Exportado como reporte oficial
  | 'ARCHIVED';       // Archivado (fin de ciclo de vida)

export interface ExpedientStateTransition {
  from: ExpedientState;
  to: ExpedientState;
  actor: string;              // Usuario/sistema que realiza transición
  timestamp: number;          // UTC timestamp
  reason?: string;            // Motivo (especialmente para REJECTED)
  signature?: string;         // Hash de firma (para SIGNED)
  notes?: string;             // Notas adicionales
}

export interface ExpedientValidation {
  isValid: boolean;
  validatedBy: string;        // Operador que validó
  validatedAt: number;        // UTC timestamp
  reason?: string;            // Motivo de rechazo
  evidenceVerified: boolean;  // ¿Se verificó evidencia?
  plateVerified: boolean;     // ¿Se verificó placa?
  speedVerified: boolean;     // ¿Se verificó velocidad?
  notes?: string;
}

export interface ExpedientSignature {
  isSigned: boolean;
  signedBy: string;
  signedAt: number;           // UTC timestamp
  signatureHash: string;      // SHA-256 de contenido firmado
  certFingerprint?: string;   // Huella digital del certificado
  method: 'manual' | 'digital' | 'biometric';
}

export interface ExpedientAuditEntry {
  timestamp: number;          // UTC
  action: string;             // DETECTED, VALIDATED, REJECTED, SIGNED, EXPORTED, etc.
  actor: string;              // Usuario/sistema
  details?: Record<string, any>;
}

/**
 * Expedient - Legal case/file for managing traffic infractions
 * Includes all fields required by BOLETÍN DE DENUNCIA
 */
export interface Expedient {
  // Identificación
  id: string;                           // Único: YYYY-MM-DD-HHmmss-trackId
  infractionId: string;                 // Referencia a InfractionLog

  // Metadatos legales
  createdAt: number;                    // UTC timestamp (cuando se detectó)
  updatedAt: number;                    // Última modificación
  state: ExpedientState;

  // Información del caso
  violationType: 'STOP' | 'FORBIDDEN_TURN' | 'SPEED_VIOLATION' | 'OTHER';
  location: string;                     // Descripción de ubicación
  timestamp: number;                    // Cuando ocurrió la infracción
  vehicleDescription: string;           // Marca/modelo (si está disponible)
  licensePlate: string;                 // Placa extraída por OCR

  // DATOS DEL LUGAR DE LA INFRACCIÓN
  via?: string;                         // Vía/Calle/Carretera
  numeroPuntoKilometrico?: string;      // KM / Nº / Punto Kilométrico
  municipio?: string;                   // Término municipal
  provincia?: string;                   // Provincia
  latitud?: number;                     // Coordenada GPS
  longitud?: number;                    // Coordenada GPS
  gravedad?: 'Leve' | 'Grave' | 'Muy Grave';  // Gravedad de la infracción

  // DATOS DEL VEHÍCULO
  marca?: string;                       // Marca del vehículo
  modelo?: string;                      // Modelo del vehículo
  color?: string;                       // Color del vehículo
  numeroChasis?: string;                // Número de bastidor (VIN)
  estadoITV?: string;                   // Estado del ITV (Vigente/Caducada)
  seguroObligatorio?: boolean;          // ¿Tiene seguro?

  // DATOS DEL TITULAR DEL VEHÍCULO
  titularNombre?: string;               // Apellidos y nombre / Razón social
  titularDNI?: string;                  // DNI / NIE / Pasaporte / CIF
  titularDomicilio?: string;            // Domicilio a efectos de notificación
  titularLocalidad?: string;            // Localidad
  titularProvincia?: string;            // Provincia
  titularTelefono?: string;             // Teléfono de contacto
  titularEmail?: string;                // Correo electrónico

  // DATOS DEL CONDUCTOR
  conductorNombre?: string;             // Apellidos y nombre del conductor
  conductorDNI?: string;                // DNI / NIE / Pasaporte / CIF
  conductorPermiso?: string;            // Número de permiso de conducir
  conductorClase?: string;              // Clase / Subclase
  conductorDomicilio?: string;          // Domicilio completo del conductor
  conductorLocalidad?: string;          // Localidad
  conductorProvincia?: string;          // Provincia
  conductorTelefono?: string;           // Teléfono de contacto
  conductorEmail?: string;              // Correo electrónico

  // DESCRIPCIÓN DE HECHOS
  descripcionDetalladaHechos?: string;  // Descripción detallada de los hechos constitutivos
  circunstanciasAgravantes?: string;    // Circunstancias agravantes

  // Evidencia
  evidenceId: string;                   // Referencia a EvidenceDB
  photosCount: number;                  // Cantidad de fotos capturadas
  videoClipHash: string;                // SHA-256 del clip de video

  // Fotos para exportación (Base64)
  image?: string;                       // Foto principal (base64)
  extraSnapshots?: string[];            // Fotos generales de contexto (base64)
  zoomSnapshots?: string[];             // Fotos de detalle/zoom (base64)

  // Validación
  validation?: ExpedientValidation;
  rejectionReason?: string;             // Si state === REJECTED

  // Firma Digital
  signature: ExpedientSignature;

  // Auditoría
  stateHistory: ExpedientStateTransition[];
  auditLog: ExpedientAuditEntry[];

  // Metadatos operacionales
  operator?: string;                    // Operador que validó
  supervisor?: string;                  // Supervisor que firmó
  tags?: string[];                      // Para categorización (urgente, recurso, etc.)

  // Cumplimiento Legal
  dpiaCertified?: boolean;              // ¿Cumple DPIA/EIPD?
  dataRetentionDays?: number;           // Días de retención
  deleteScheduledAt?: number;           // Cuándo se eliminará
}

/**
 * Crear expediente nuevo
 */
export function createExpedient(
  infractionId: string,
  violationType: Expedient['violationType'],
  location: string,
  timestamp: number,
  evidenceId: string,
  licensePlate: string
): Expedient {
  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 19).replace(/[-:]/g, '');
  const id = `EXP-${dateStr}-${infractionId}`;

  return {
    id,
    infractionId,
    createdAt: now,
    updatedAt: now,
    state: 'DETECTED',
    violationType,
    location,
    timestamp,
    vehicleDescription: '',
    licensePlate,
    evidenceId,
    photosCount: 0,
    videoClipHash: '',
    signature: {
      isSigned: false,
      signedBy: '',
      signedAt: 0,
      signatureHash: '',
      method: 'manual',
    },
    stateHistory: [
      {
        from: 'DETECTED' as any,
        to: 'DETECTED',
        actor: 'SYSTEM',
        timestamp: now,
        reason: 'Automatic detection',
      },
    ],
    auditLog: [
      {
        timestamp: now,
        action: 'CREATED',
        actor: 'SYSTEM',
        details: { violationType, location },
      },
    ],
  };
}

/**
 * Validar expediente para firma
 */
export function isExpedientReadyForSignature(expedient: Expedient): boolean {
  return (
    expedient.state === 'VALIDATED' &&
    !!expedient.validation?.isValid &&
    !!expedient.licensePlate &&
    !!expedient.evidenceId &&
    expedient.photosCount > 0
  );
}

/**
 * Validar expediente para exportación
 */
export function isExpedientReadyForExport(expedient: Expedient): boolean {
  return (
    expedient.state === 'SIGNED' &&
    expedient.signature.isSigned &&
    !!expedient.signature.signatureHash
  );
}
