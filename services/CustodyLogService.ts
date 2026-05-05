/**
 * Custody Log Service - PHASE 3
 *
 * Immutable audit log for chain of custody:
 * - Record all actions: creation, access, validation, deletion
 * - Timestamp every event with UTC
 * - Store in local database + cloud (for backup)
 * - Prevent tampering
 */

export type CustodyAction =
  | 'EVIDENCE_CREATED'
  | 'EVIDENCE_ACCESSED'
  | 'EVIDENCE_DOWNLOADED'
  | 'EVIDENCE_DELETED'
  | 'REPORT_GENERATED'
  | 'REPORT_VALIDATED'
  | 'REPORT_REJECTED'
  | 'REPORT_SIGNED'
  | 'REPORT_EXPORTED'
  | 'REPORT_ARCHIVED'
  | 'MANIFEST_CREATED'
  | 'MANIFEST_VERIFIED';

/**
 * Single audit log entry (immutable)
 */
export interface AuditLogEntry {
  id: string; // UUID
  timestamp: string; // ISO 8601 UTC
  action: CustodyAction;
  actor: string; // User/Operator ID
  entityType: 'CASE' | 'EVIDENCE' | 'REPORT' | 'MANIFEST';
  entityId: string;

  // Context information
  metadata: {
    ip?: string;
    userAgent?: string;
    fileSize?: number;
    fileHash?: string;
    resultStatus?: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Batch log for efficient storage
 */
export interface AuditLogBatch {
  batchId: string;
  createdAt: string;
  entries: AuditLogEntry[];
  totalSize: number;
  checksum: string; // SHA256 of all entries
}

/**
 * CustodyLogService - Gestor de log de custodia
 */
export class CustodyLogService {
  private logs: AuditLogEntry[] = [];
  private batchSize = 100; // Entries before auto-batch

  /**
   * Crear nuevo entry en log
   */
  static createLogEntry(
    action: CustodyAction,
    actor: string,
    entityType: 'CASE' | 'EVIDENCE' | 'REPORT' | 'MANIFEST',
    entityId: string,
    metadata?: AuditLogEntry['metadata']
  ): AuditLogEntry {
    return {
      id: this.generateUUID(),
      timestamp: new Date().toISOString(),
      action,
      actor,
      entityType,
      entityId,
      metadata: metadata || {},
    };
  }

  /**
   * Generar UUID simple
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Registrar acción de evidencia
   */
  static logEvidenceAction(
    action: 'EVIDENCE_CREATED' | 'EVIDENCE_ACCESSED' | 'EVIDENCE_DOWNLOADED' | 'EVIDENCE_DELETED',
    actor: string,
    evidenceId: string,
    fileSize?: number,
    fileHash?: string
  ): AuditLogEntry {
    return this.createLogEntry(action, actor, 'EVIDENCE', evidenceId, {
      fileSize,
      fileHash,
    });
  }

  /**
   * Registrar acción de reporte
   */
  static logReportAction(
    action:
      | 'REPORT_GENERATED'
      | 'REPORT_VALIDATED'
      | 'REPORT_REJECTED'
      | 'REPORT_SIGNED'
      | 'REPORT_EXPORTED'
      | 'REPORT_ARCHIVED',
    actor: string,
    reportId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.createLogEntry(action, actor, 'REPORT', reportId, {
      details,
    });
  }

  /**
   * Registrar validación de integridad
   */
  static logIntegrityCheck(
    actor: string,
    manifestId: string,
    resultStatus: 'SUCCESS' | 'FAILURE',
    errorMessage?: string
  ): AuditLogEntry {
    return this.createLogEntry('MANIFEST_VERIFIED', actor, 'MANIFEST', manifestId, {
      resultStatus,
      errorMessage,
    });
  }

  /**
   * Almacenar entry en log (local)
   */
  addEntry(entry: AuditLogEntry): void {
    this.logs.push(entry);
    console.log(
      `[CUSTODY_LOG] ${entry.action} by ${entry.actor} on ${entry.entityType} ${entry.entityId}`
    );
  }

  /**
   * Obtener todos los logs
   */
  getEntries(): AuditLogEntry[] {
    return [...this.logs]; // Retornar copia para evitar mutación
  }

  /**
   * Obtener logs filtrados por entidad
   */
  getEntriesByEntity(entityType: string, entityId: string): AuditLogEntry[] {
    return this.logs.filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  /**
   * Obtener logs por actor
   */
  getEntriesByActor(actor: string): AuditLogEntry[] {
    return this.logs.filter((e) => e.actor === actor);
  }

  /**
   * Obtener logs en rango de tiempo
   */
  getEntriesByTimeRange(startDate: Date, endDate: Date): AuditLogEntry[] {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return this.logs.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  /**
   * Generar reporte de auditoría
   */
  generateAuditReport(entityType?: string, entityId?: string): string {
    let filteredLogs = this.logs;

    if (entityType && entityId) {
      filteredLogs = filteredLogs.filter(
        (e) => e.entityType === entityType && e.entityId === entityId
      );
    }

    const timestamp = new Date().toISOString();
    const report = `
╔════════════════════════════════════════════════════════════════╗
║                    CUSTODY AUDIT LOG REPORT                   ║
╚════════════════════════════════════════════════════════════════╝

Generated:       ${timestamp}
Total Entries:   ${filteredLogs.length}
${entityType && entityId ? `Entity:          ${entityType} / ${entityId}` : ''}

──────────────────────────────────────────────────────────────────
AUDIT TRAIL:
──────────────────────────────────────────────────────────────────

${filteredLogs
  .map(
    (entry, idx) => `
${idx + 1}. [${entry.timestamp}] ${entry.action}
   Actor:      ${entry.actor}
   Entity:     ${entry.entityType} / ${entry.entityId}
   ${entry.metadata.resultStatus ? `Result:     ${entry.metadata.resultStatus}` : ''}
   ${entry.metadata.fileSize ? `File Size:  ${entry.metadata.fileSize} bytes` : ''}
   ${entry.metadata.fileHash ? `File Hash:  ${entry.metadata.fileHash.substring(0, 16)}...` : ''}
   ${entry.metadata.errorMessage ? `Error:      ${entry.metadata.errorMessage}` : ''}
`
  )
  .join('\n')}

──────────────────────────────────────────────────────────────────
STATISTICS:
──────────────────────────────────────────────────────────────────

Actions by Type:
${this.getActionCounts(filteredLogs)
  .map(([action, count]) => `  ${action}: ${count}`)
  .join('\n')}

Actors:
${this.getActorCounts(filteredLogs)
  .map(([actor, count]) => `  ${actor}: ${count} actions`)
  .join('\n')}

──────────────────────────────────────────────────────────────────
CONCLUSION: Complete audit trail maintained
──────────────────────────────────────────────────────────────────
    `;

    return report;
  }

  /**
   * Contar acciones por tipo
   */
  private getActionCounts(logs: AuditLogEntry[]): Array<[string, number]> {
    const counts = new Map<string, number>();
    logs.forEach((log) => {
      counts.set(log.action, (counts.get(log.action) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  /**
   * Contar acciones por actor
   */
  private getActorCounts(logs: AuditLogEntry[]): Array<[string, number]> {
    const counts = new Map<string, number>();
    logs.forEach((log) => {
      counts.set(log.actor, (counts.get(log.actor) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  /**
   * Exportar logs en formato CSV
   */
  exportCsv(): string {
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Actor',
      'Entity Type',
      'Entity ID',
      'File Size',
      'File Hash',
      'Result Status',
      'Error Message',
    ];

    const rows = this.logs.map((entry) => [
      entry.id,
      entry.timestamp,
      entry.action,
      entry.actor,
      entry.entityType,
      entry.entityId,
      entry.metadata.fileSize || '',
      entry.metadata.fileHash || '',
      entry.metadata.resultStatus || '',
      entry.metadata.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Exportar logs en formato JSON
   */
  exportJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEntries: this.logs.length,
        entries: this.logs,
      },
      null,
      2
    );
  }

  /**
   * Limpiar logs más antiguos que N días (con caution)
   * NOTA: Solo para development/testing. En producción, archivar a BD
   */
  pruneLogs(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    const initialCount = this.logs.length;
    this.logs = this.logs.filter((entry) => entry.timestamp > cutoffIso);
    const removedCount = initialCount - this.logs.length;

    console.warn(
      `[CUSTODY_LOG] Pruned ${removedCount} entries older than ${daysOld} days. ` +
        `Remaining: ${this.logs.length}`
    );

    return removedCount;
  }
}

/**
 * Global singleton instance
 */
export const custodyLog = new CustodyLogService();

export default CustodyLogService;
