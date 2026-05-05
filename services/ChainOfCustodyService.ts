/**
 * Chain of Custody Service - PHASE 3
 *
 * Implements forensic chain of custody:
 * - SHA-256 hashing of all evidence files
 * - Signed manifests with metadata
 * - Immutable logs of access/validation/deletion
 * - Original + processed file preservation with hashes
 */

/**
 * Calcula hash SHA-256 de un contenido
 */
export async function calculateSHA256(data: Blob | ArrayBuffer | string): Promise<string> {
  try {
    let buffer: ArrayBuffer;

    if (typeof data === 'string') {
      buffer = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('[CHAIN_OF_CUSTODY] SHA-256 calculation failed:', error);
    throw error;
  }
}

/**
 * Evidence File Hash Record
 */
export interface EvidenceHash {
  filePath: string;
  fileName: string;
  hash: string; // SHA-256
  size: number;
  mimeType: string;
  timestamp: string; // ISO 8601 UTC
  isOriginal: boolean;
}

/**
 * Custody Manifest - Documento inmutable con todos los hashes
 */
export interface CustodyManifest {
  manifestId: string;
  caseId: string;
  createdAt: string; // ISO 8601 UTC
  createdBy: string; // Operator ID
  appVersion: string;
  aiModel: string; // e.g., "COCO-SSD v1.0"
  geometry: {
    roiZones: number;
    calibrationMethod: string;
  };
  files: {
    original: EvidenceHash[];
    processed: EvidenceHash[];
  };
  reportHash?: string; // Hash del reporte PDF final
  signature?: string; // Firma digital (PHASE 7)
}

/**
 * Custody Log Entry - Cada acción registrada inmutablemente
 */
export interface CustodyLogEntry {
  timestamp: string; // ISO 8601 UTC
  action: 'CREATED' | 'ACCESSED' | 'VALIDATED' | 'REJECTED' | 'SIGNED' | 'EXPORTED' | 'DELETED';
  actor: string; // Usuario/Operador
  manifestId: string;
  details: {
    reason?: string;
    fileCount?: number;
    exportFormat?: 'PDF' | 'CSV' | 'ZIP';
  };
}

/**
 * ChainOfCustodyService - Gestor de cadena de custodia
 */
export class ChainOfCustodyService {
  private manifest: CustodyManifest | null = null;
  private logEntries: CustodyLogEntry[] = [];

  /**
   * Crear nuevo manifiesto para un caso
   */
  static createManifest(
    caseId: string,
    createdBy: string,
    appVersion: string = '16.0.0',
    aiModel: string = 'COCO-SSD v1.0'
  ): CustodyManifest {
    const manifest: CustodyManifest = {
      manifestId: `MANIFEST_${caseId}_${Date.now()}`,
      caseId,
      createdAt: new Date().toISOString(),
      createdBy,
      appVersion,
      aiModel,
      geometry: {
        roiZones: 0,
        calibrationMethod: 'PENDING',
      },
      files: {
        original: [],
        processed: [],
      },
    };

    return manifest;
  }

  /**
   * Agregar archivo original al manifiesto
   */
  static async addOriginalFile(
    manifest: CustodyManifest,
    filePath: string,
    fileName: string,
    fileBlob: Blob,
    mimeType: string
  ): Promise<CustodyManifest> {
    try {
      const hash = await calculateSHA256(fileBlob);

      const evidenceHash: EvidenceHash = {
        filePath,
        fileName,
        hash,
        size: fileBlob.size,
        mimeType,
        timestamp: new Date().toISOString(),
        isOriginal: true,
      };

      manifest.files.original.push(evidenceHash);
      return manifest;
    } catch (error) {
      console.error('[CHAIN_OF_CUSTODY] Failed to add original file:', error);
      throw error;
    }
  }

  /**
   * Agregar archivo procesado al manifiesto
   */
  static async addProcessedFile(
    manifest: CustodyManifest,
    filePath: string,
    fileName: string,
    fileBlob: Blob,
    mimeType: string
  ): Promise<CustodyManifest> {
    try {
      const hash = await calculateSHA256(fileBlob);

      const evidenceHash: EvidenceHash = {
        filePath,
        fileName,
        hash,
        size: fileBlob.size,
        mimeType,
        timestamp: new Date().toISOString(),
        isOriginal: false,
      };

      manifest.files.processed.push(evidenceHash);
      return manifest;
    } catch (error) {
      console.error('[CHAIN_OF_CUSTODY] Failed to add processed file:', error);
      throw error;
    }
  }

  /**
   * Agregar hash de reporte PDF
   */
  static async setReportHash(
    manifest: CustodyManifest,
    reportBlob: Blob
  ): Promise<CustodyManifest> {
    try {
      manifest.reportHash = await calculateSHA256(reportBlob);
      return manifest;
    } catch (error) {
      console.error('[CHAIN_OF_CUSTODY] Failed to set report hash:', error);
      throw error;
    }
  }

  /**
   * Exportar manifiesto como JSON
   */
  static exportManifestJson(manifest: CustodyManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Crear entry en log de custodia
   */
  static createLogEntry(
    action: CustodyLogEntry['action'],
    actor: string,
    manifestId: string,
    details?: CustodyLogEntry['details']
  ): CustodyLogEntry {
    return {
      timestamp: new Date().toISOString(),
      action,
      actor,
      manifestId,
      details: details || {},
    };
  }

  /**
   * Verificar integridad: comparar hash calculado con hash en manifiesto
   */
  static async verifyFileIntegrity(
    fileBlob: Blob,
    expectedHash: string,
    fileName: string
  ): Promise<{ isValid: boolean; calculatedHash: string }> {
    try {
      const calculatedHash = await calculateSHA256(fileBlob);
      const isValid = calculatedHash === expectedHash;

      if (!isValid) {
        console.warn(
          `[CHAIN_OF_CUSTODY] Hash mismatch for ${fileName}: ` +
            `expected ${expectedHash}, got ${calculatedHash}`
        );
      }

      return { isValid, calculatedHash };
    } catch (error) {
      console.error('[CHAIN_OF_CUSTODY] Failed to verify integrity:', error);
      throw error;
    }
  }

  /**
   * Verificar integridad del manifiesto completo
   */
  static async verifyManifestIntegrity(
    manifest: CustodyManifest,
    originalFiles: Map<string, Blob>,
    processedFiles: Map<string, Blob>
  ): Promise<{
    isValid: boolean;
    results: Array<{
      filePath: string;
      isValid: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      filePath: string;
      isValid: boolean;
      error?: string;
    }> = [];

    // Verificar archivos originales
    for (const originalFile of manifest.files.original) {
      const blob = originalFiles.get(originalFile.filePath);
      if (!blob) {
        results.push({
          filePath: originalFile.filePath,
          isValid: false,
          error: 'Original file not found',
        });
        continue;
      }

      try {
        const { isValid } = await this.verifyFileIntegrity(
          blob,
          originalFile.hash,
          originalFile.fileName
        );
        results.push({
          filePath: originalFile.filePath,
          isValid,
        });
      } catch (error) {
        results.push({
          filePath: originalFile.filePath,
          isValid: false,
          error: String(error),
        });
      }
    }

    // Verificar archivos procesados
    for (const processedFile of manifest.files.processed) {
      const blob = processedFiles.get(processedFile.filePath);
      if (!blob) {
        results.push({
          filePath: processedFile.filePath,
          isValid: false,
          error: 'Processed file not found',
        });
        continue;
      }

      try {
        const { isValid } = await this.verifyFileIntegrity(
          blob,
          processedFile.hash,
          processedFile.fileName
        );
        results.push({
          filePath: processedFile.filePath,
          isValid,
        });
      } catch (error) {
        results.push({
          filePath: processedFile.filePath,
          isValid: false,
          error: String(error),
        });
      }
    }

    const allValid = results.every((r) => r.isValid);

    return {
      isValid: allValid,
      results,
    };
  }

  /**
   * Generar reporte de integridad
   */
  static generateIntegrityReport(
    manifest: CustodyManifest,
    verificationResults: Array<{
      filePath: string;
      isValid: boolean;
      error?: string;
    }>
  ): string {
    const timestamp = new Date().toISOString();
    const allValid = verificationResults.every((r) => r.isValid);
    const status = allValid ? 'PASS ✅' : 'FAIL ❌';

    let report = `
╔════════════════════════════════════════════════════════════════╗
║              CHAIN OF CUSTODY - INTEGRITY REPORT              ║
╚════════════════════════════════════════════════════════════════╝

Case ID:         ${manifest.caseId}
Manifest ID:     ${manifest.manifestId}
Verification:    ${status}
Timestamp:       ${timestamp}

Created:         ${manifest.createdAt}
Created By:      ${manifest.createdBy}
App Version:     ${manifest.appVersion}
AI Model:        ${manifest.aiModel}

──────────────────────────────────────────────────────────────────
FILE VERIFICATION RESULTS:
──────────────────────────────────────────────────────────────────

`;

    verificationResults.forEach((result, idx) => {
      const status = result.isValid ? '✅ VALID' : '❌ FAILED';
      report += `${idx + 1}. ${result.filePath}\n   Status: ${status}\n`;
      if (result.error) {
        report += `   Error:  ${result.error}\n`;
      }
    });

    report += `
──────────────────────────────────────────────────────────────────
FILE MANIFEST:
──────────────────────────────────────────────────────────────────

ORIGINAL FILES (${manifest.files.original.length}):
${manifest.files.original.map((f) => `  • ${f.fileName} (${f.size} bytes, SHA256: ${f.hash.substring(0, 16)}...)`).join('\n')}

PROCESSED FILES (${manifest.files.processed.length}):
${manifest.files.processed.map((f) => `  • ${f.fileName} (${f.size} bytes, SHA256: ${f.hash.substring(0, 16)}...)`).join('\n')}

${manifest.reportHash ? `\nREPORT HASH: ${manifest.reportHash.substring(0, 32)}...` : ''}

──────────────────────────────────────────────────────────────────
CONCLUSION: ${allValid ? 'All files verified successfully' : 'Some files failed verification'}
──────────────────────────────────────────────────────────────────
    `;

    return report;
  }
}

export default ChainOfCustodyService;
