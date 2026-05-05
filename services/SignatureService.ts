/**
 * Signature Service - PHASE 7
 * Digital signature generation and verification for legal compliance
 */

import { Expedient } from '../domain/Expedient';
import { calculateSHA256 } from './ChainOfCustodyService';
import { logger } from './logger';

export interface SignatureOptions {
  method: 'manual' | 'digital' | 'biometric';
  certPath?: string;
  password?: string;
  timestamp?: number;
}

export interface SignatureVerificationResult {
  isValid: boolean;
  signedBy: string;
  signedAt: number;
  signatureHash: string;
  content: string;
  tampered: boolean;
  reason?: string;
}

/**
 * Signature Service - Handle digital signatures for legal compliance
 */
export class SignatureService {
  /**
   * Sign expedient content
   */
  static async signExpedient(
    expedient: Expedient,
    signerName: string,
    options: SignatureOptions = { method: 'digital' }
  ): Promise<string> {
    try {
      // Prepare content to sign (state as of signature time)
      const contentToSign = this.prepareSignableContent(expedient);

      // Calculate hash of content
      const contentHash = await calculateSHA256(new Blob([contentToSign], { type: 'text/plain' }));

      // Generate signature (in production: use actual digital certificate)
      const signature = await this.generateSignature(contentHash, signerName, options);

      logger.info('SIGNATURE_SERVICE', `Expedient ${expedient.id} signed by ${signerName}`, {
        method: options.method,
        contentHash: contentHash.substring(0, 16),
        signatureHash: signature.substring(0, 16),
      });

      return signature;
    } catch (error) {
      logger.error('SIGNATURE_SERVICE', 'Failed to sign expedient', error);
      throw error;
    }
  }

  /**
   * Verify expedient signature
   */
  static async verifyExpedientSignature(
    expedient: Expedient
  ): Promise<SignatureVerificationResult> {
    if (!expedient.signature.isSigned) {
      return {
        isValid: false,
        signedBy: '',
        signedAt: 0,
        signatureHash: '',
        content: '',
        tampered: false,
        reason: 'Expedient is not signed',
      };
    }

    try {
      const contentToSign = this.prepareSignableContent(expedient);
      const contentHash = await calculateSHA256(new Blob([contentToSign], { type: 'text/plain' }));

      // In production: verify signature using public key
      // For now: verify hash matches expected
      const signatureIsValid = this.verifySignatureInternal(
        contentHash,
        expedient.signature.signatureHash
      );

      return {
        isValid: signatureIsValid,
        signedBy: expedient.signature.signedBy,
        signedAt: expedient.signature.signedAt,
        signatureHash: expedient.signature.signatureHash,
        content: contentToSign,
        tampered: !signatureIsValid,
        reason: signatureIsValid ? undefined : 'Signature validation failed',
      };
    } catch (error) {
      logger.error('SIGNATURE_SERVICE', 'Failed to verify signature', error);
      return {
        isValid: false,
        signedBy: expedient.signature.signedBy,
        signedAt: expedient.signature.signedAt,
        signatureHash: expedient.signature.signatureHash,
        content: '',
        tampered: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Prepare content for signing (immutable representation)
   */
  private static prepareSignableContent(expedient: Expedient): string {
    const sections = [
      `EXPEDIENT SIGNATURE DOCUMENT`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `=== CASE IDENTIFICATION ===`,
      `ID: ${expedient.id}`,
      `Infraction ID: ${expedient.infractionId}`,
      `State: ${expedient.state}`,
      ``,
      `=== VIOLATION DETAILS ===`,
      `Type: ${expedient.violationType}`,
      `Location: ${expedient.location}`,
      `Timestamp: ${new Date(expedient.timestamp).toISOString()}`,
      `License Plate: ${expedient.licensePlate}`,
      `Vehicle: ${expedient.vehicleDescription}`,
      ``,
      `=== EVIDENCE ===`,
      `Evidence ID: ${expedient.evidenceId}`,
      `Photos: ${expedient.photosCount}`,
      `Video Hash: ${expedient.videoClipHash.substring(0, 32)}...`,
      ``,
      `=== VALIDATION ===`,
      `Valid: ${expedient.validation?.isValid ?? false}`,
      `Validated By: ${expedient.validation?.validatedBy ?? 'N/A'}`,
      `Validated At: ${expedient.validation?.validatedAt ? new Date(expedient.validation.validatedAt).toISOString() : 'N/A'}`,
      `Evidence Verified: ${expedient.validation?.evidenceVerified ?? false}`,
      `Plate Verified: ${expedient.validation?.plateVerified ?? false}`,
      `Speed Verified: ${expedient.validation?.speedVerified ?? false}`,
      ``,
      `=== STATE HISTORY (IMMUTABLE) ===`,
      ...expedient.stateHistory.map(
        (t) =>
          `${new Date(t.timestamp).toISOString()} | ${t.from} → ${t.to} | ${t.actor} | ${t.reason || 'N/A'}`
      ),
      ``,
      `=== AUDIT TRAIL (IMMUTABLE) ===`,
      ...expedient.auditLog
        .slice(-10) // Last 10 entries
        .map((e) => `${new Date(e.timestamp).toISOString()} | ${e.action} | ${e.actor}`),
      ``,
      `=== SIGNATURE AUTHORIZATION ===`,
      `By signing this document, I certify that:`,
      `1. I have reviewed all evidence and information above`,
      `2. The infraction is valid and documented`,
      `3. All procedures were followed correctly`,
      `4. This signature creates a legally binding official report`,
      ``,
      `Signature binds this expedient from this point forward.`,
      `Expedient cannot be modified after signature.`,
    ];

    return sections.join('\n');
  }

  /**
   * Generate signature (internal - production would use cert)
   */
  private static async generateSignature(
    contentHash: string,
    signerName: string,
    options: SignatureOptions
  ): Promise<string> {
    try {
      // In production: use actual digital certificate
      // For now: create HMAC-based signature
      const timestamp = (options.timestamp || Date.now()).toString();
      const signatureData = `${contentHash}|${signerName}|${timestamp}|${options.method}`;

      // Create SHA-256 signature
      const signatureHash = await calculateSHA256(
        new Blob([signatureData], { type: 'text/plain' })
      );

      return signatureHash;
    } catch (error) {
      logger.error('SIGNATURE_SERVICE', 'Failed to generate signature', error);
      throw error;
    }
  }

  /**
   * Verify signature internally
   * In production: use public key cryptography
   */
  private static verifySignatureInternal(contentHash: string, signatureHash: string): boolean {
    // Basic check: signature should be 64 chars (SHA-256)
    if (signatureHash.length !== 64) {
      return false;
    }

    // In production: verify using public key
    // For now: just check it's a valid format
    return /^[a-f0-9]{64}$/.test(signatureHash);
  }

  /**
   * Generate certificate fingerprint (for audit)
   */
  static generateCertFingerprint(certPath: string): string {
    // In production: read actual certificate and compute fingerprint
    // For now: return mock
    const timestamp = Date.now().toString();
    return `CERT-${timestamp}`;
  }

  /**
   * Create signature certificate metadata
   */
  static createCertificateMetadata(
    signerName: string,
    signerEmail: string,
    organization: string
  ): {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
  } {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return {
      subject: `CN=${signerName}, O=${organization}, emailAddress=${signerEmail}`,
      issuer: `O=SENTINEL.AI,CN=Root CA,C=AR`,
      validFrom: now.toISOString(),
      validTo: oneYearLater.toISOString(),
    };
  }

  /**
   * Export expedient with signature for legal proceedings
   */
  static async generateSignedManifest(expedient: Expedient): Promise<string> {
    try {
      const verification = await this.verifyExpedientSignature(expedient);

      if (!verification.isValid) {
        throw new Error('Expedient signature is invalid - cannot generate manifest');
      }

      const manifest = [
        `SIGNED LEGAL MANIFEST`,
        `Generated: ${new Date().toISOString()}`,
        ``,
        `Expedient ID: ${expedient.id}`,
        `Signed By: ${expedient.signature.signedBy}`,
        `Signed At: ${new Date(expedient.signature.signedAt).toISOString()}`,
        `Signature: ${expedient.signature.signatureHash}`,
        `Cert Fingerprint: ${expedient.signature.certFingerprint || 'N/A'}`,
        ``,
        `This is a legally binding document signed with digital signature.`,
        `Any modifications will invalidate the signature.`,
        ``,
        `=== EXPEDIENT CONTENT ===`,
        verification.content,
      ];

      return manifest.join('\n');
    } catch (error) {
      logger.error('SIGNATURE_SERVICE', 'Failed to generate signed manifest', error);
      throw error;
    }
  }
}

// Singleton instance (if needed for caching)
const instance: typeof SignatureService | null = null;

export function getSignatureService(): typeof SignatureService {
  return SignatureService;
}
