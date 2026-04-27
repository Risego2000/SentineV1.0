/**
 * OCR Tests - PHASE 8
 * Unit tests for license plate validation and extraction
 */

import {
  validatePlateFormat,
  validateOCRConfidence,
  isGenericText,
  hasValidCharacters,
  validateOCRResult,
  selectBestPlate,
  generateValidationReport,
  OCRCandidate,
  PlateValidationResult,
} from '../domain/validation';

describe('OCR System - PHASE 8', () => {
  describe('Plate Format Validation - Spain & Europe', () => {
    it('should accept valid Spanish format (LLLL-NNN)', () => {
      const result = validatePlateFormat('ABCD-123');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('spain');
      expect(result.confidence).toBe(1.0);
    });

    it('should accept Spanish format without hyphen', () => {
      const result = validatePlateFormat('ABCD123');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('spain');
    });

    it('should accept Spanish historic format (NNN-LLL)', () => {
      const result = validatePlateFormat('123-ABC');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('spain_historic');
    });

    it('should accept German format (AB-12-XYZ)', () => {
      const result = validatePlateFormat('AB-12-XYZ');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('europe');
    });

    it('should accept French format (AB-123-CD)', () => {
      const result = validatePlateFormat('AB-123-CD');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('europe');
    });

    it('should accept Italian format (AB-123-CD)', () => {
      const result = validatePlateFormat('XY-456-ZW');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('europe');
    });

    it('should accept UK format (AB12-CDE)', () => {
      const result = validatePlateFormat('AB12CDE');

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('europe');
    });

    it('should reject invalid format (only letters)', () => {
      const result = validatePlateFormat('ABCDEF');

      expect(result.isValid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should reject invalid format (only numbers)', () => {
      const result = validatePlateFormat('123456');

      expect(result.isValid).toBe(false);
    });

    it('should reject plate that is too short', () => {
      const result = validatePlateFormat('AB12');

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('length'))).toBe(true);
    });

    it('should reject plate that is too long', () => {
      const result = validatePlateFormat('ABC123456789');

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('length'))).toBe(true);
    });

    it('should reject plate with invalid character patterns', () => {
      const result = validatePlateFormat('A@-1234'); // Invalid characters

      expect(result.isValid).toBe(false);
    });
  });

  describe('Confidence Threshold Validation', () => {
    it('should accept confidence >= 0.85', () => {
      const result = validateOCRConfidence(0.85);

      expect(result.isValid).toBe(true);
    });

    it('should accept high confidence (0.95)', () => {
      const result = validateOCRConfidence(0.95);

      expect(result.isValid).toBe(true);
    });

    it('should reject confidence < 0.85', () => {
      const result = validateOCRConfidence(0.84);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('too low');
    });

    it('should reject confidence out of range (>1.0)', () => {
      const result = validateOCRConfidence(1.5);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('out of range');
    });

    it('should reject confidence out of range (<0)', () => {
      const result = validateOCRConfidence(-0.5);

      expect(result.isValid).toBe(false);
    });

    it('should accept custom minimum confidence', () => {
      const result = validateOCRConfidence(0.75, 0.7);

      expect(result.isValid).toBe(true);
    });

    it('should reject custom minimum confidence', () => {
      const result = validateOCRConfidence(0.65, 0.7);

      expect(result.isValid).toBe(false);
    });
  });

  describe('Generic Text Detection', () => {
    it('should reject "TEST"', () => {
      expect(isGenericText('TEST')).toBe(true);
    });

    it('should reject "SAMPLE"', () => {
      expect(isGenericText('SAMPLE')).toBe(true);
    });

    it('should reject "NOPLATE"', () => {
      expect(isGenericText('NOPLATE')).toBe(true);
    });

    it('should reject "UNREADABLE"', () => {
      expect(isGenericText('UNREADABLE')).toBe(true);
    });

    it('should reject "OBSCURED"', () => {
      expect(isGenericText('OBSCURED')).toBe(true);
    });

    it('should accept valid plate text', () => {
      expect(isGenericText('AB1234')).toBe(false);
    });

    it('should accept mixed case generic text in lowercase', () => {
      expect(isGenericText('test')).toBe(true); // Case-insensitive
    });
  });

  describe('Character Validation', () => {
    it('should accept alphanumeric with separators', () => {
      expect(hasValidCharacters('AB-1234')).toBe(true);
      expect(hasValidCharacters('AB 1234')).toBe(true);
      expect(hasValidCharacters('AB.1234')).toBe(true);
    });

    it('should reject text without letters', () => {
      expect(hasValidCharacters('1234')).toBe(false);
    });

    it('should reject text without numbers', () => {
      expect(hasValidCharacters('ABCD')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(hasValidCharacters('AB@1234')).toBe(false);
      expect(hasValidCharacters('AB#1234')).toBe(false);
    });
  });

  describe('Complete OCR Validation', () => {
    it('should validate correct Spanish plate with high confidence', () => {
      const result = validateOCRResult('ABCD-123', 0.95);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('spain');
      expect(result.confidence).toBe(0.95);
    });

    it('should validate correct European plate with high confidence', () => {
      const result = validateOCRResult('AB-123-CD', 0.92);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('europe');
      expect(result.confidence).toBe(0.92);
    });

    it('should reject generic text even with high confidence', () => {
      const result = validateOCRResult('TEST', 0.99);

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.toLowerCase().includes('generic'))).toBe(true);
    });

    it('should reject valid format with low confidence', () => {
      const result = validateOCRResult('ABCD-123', 0.75);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasons.some((r) => r.includes('too low'))).toBe(true);
    });

    it('should reject invalid format even with high confidence', () => {
      const result = validateOCRResult('ABCDEF', 0.95);

      expect(result.isValid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should provide detailed rejection reasons', () => {
      const result = validateOCRResult('A8-1234', 0.75);

      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Character') || r.includes('too low'))).toBe(true);
    });
  });

  describe('Plate Candidate Selection', () => {
    it('should select valid Spanish format over high confidence generic', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'TEST',
          confidence: 0.99,
          frame: 0,
          validation: validateOCRResult('TEST', 0.99),
          selected: false,
        },
        {
          text: 'ABCD-123',
          confidence: 0.87,
          frame: 1,
          validation: validateOCRResult('ABCD-123', 0.87),
          selected: false,
        },
      ];

      const selected = selectBestPlate(candidates);

      expect(selected?.text).toBe('ABCD-123');
      expect(selected?.validation.isValid).toBe(true);
    });

    it('should select highest confidence when all valid (Spanish)', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'ABCD-123',
          confidence: 0.87,
          frame: 0,
          validation: validateOCRResult('ABCD-123', 0.87),
          selected: false,
        },
        {
          text: 'ABCD-124',
          confidence: 0.92,
          frame: 1,
          validation: validateOCRResult('ABCD-124', 0.92),
          selected: false,
        },
      ];

      const selected = selectBestPlate(candidates);

      expect(selected?.text).toBe('ABCD-124');
      expect(selected?.confidence).toBe(0.92);
    });

    it('should select valid European format', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'AB-123-CD',
          confidence: 0.90,
          frame: 0,
          validation: validateOCRResult('AB-123-CD', 0.90),
          selected: false,
        },
        {
          text: 'UNCLEAR',
          confidence: 0.45,
          frame: 1,
          validation: validateOCRResult('UNCLEAR', 0.45),
          selected: false,
        },
      ];

      const selected = selectBestPlate(candidates);

      expect(selected?.text).toBe('AB-123-CD');
      expect(selected?.validation.isValid).toBe(true);
    });

    it('should return null if no candidates', () => {
      const candidates: OCRCandidate[] = [];
      const selected = selectBestPlate(candidates);

      expect(selected).toBeNull();
    });

    it('should return null if all candidates invalid', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'TEST',
          confidence: 0.99,
          frame: 0,
          validation: validateOCRResult('TEST', 0.99),
          selected: false,
        },
        {
          text: 'SAMPLE',
          confidence: 0.95,
          frame: 1,
          validation: validateOCRResult('SAMPLE', 0.95),
          selected: false,
        },
      ];

      const selected = selectBestPlate(candidates);

      expect(selected).toBeNull();
    });
  });

  describe('Validation Report Generation', () => {
    it('should generate report with statistics', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'ABCD-123',
          confidence: 0.92,
          frame: 0,
          validation: validateOCRResult('ABCD-123', 0.92),
          selected: true,
          reason: 'Highest confidence',
        },
        {
          text: 'TEST',
          confidence: 0.99,
          frame: 1,
          validation: validateOCRResult('TEST', 0.99),
          selected: false,
        },
      ];

      const selected = candidates[0];
      const report = generateValidationReport(candidates, selected);

      expect(report.totalCandidates).toBe(2);
      expect(report.validCandidates).toBe(1);
      expect(report.selectedText).toBe('ABCD-123');
      expect(report.selectedConfidence).toBe(0.92);
      expect(report.report).toContain('ABCD-123');
    });

    it('should indicate NONE if no selection', () => {
      const candidates: OCRCandidate[] = [
        {
          text: 'TEST',
          confidence: 0.99,
          frame: 0,
          validation: validateOCRResult('TEST', 0.99),
          selected: false,
        },
      ];

      const report = generateValidationReport(candidates, null);

      expect(report.selectedText).toBe('NONE');
      expect(report.selectedConfidence).toBe(0);
    });
  });

  describe('Multi-Frame Robustness', () => {
    it('should handle multiple frames with same Spanish plate', () => {
      const frames = ['ABCD-123', 'ABCD-123', 'ABCD-123'];

      const validFrames = frames.filter((text) => validateOCRResult(text, 0.90).isValid);
      expect(validFrames.length).toBe(3); // All should be valid
    });

    it('should handle multiple frames with Spanish variations', () => {
      const frames = ['ABCD-123', 'ABCD-124', 'ACDE-123']; // Slight OCR variations

      const validFrames = frames.filter((text) => validateOCRResult(text, 0.90).isValid);
      expect(validFrames.length).toBe(3); // All are valid formats

      // A real system would de-duplicate by voting
    });

    it('should handle multiple frames with European plates', () => {
      const frames = ['AB-123-CD', 'AB-124-CD', 'AC-123-CD']; // European format variations

      const validFrames = frames.filter((text) => validateOCRResult(text, 0.85).isValid);
      expect(validFrames.length).toBeGreaterThan(0);
    });

    it('should handle frame with low confidence', () => {
      const frames = ['ABCD-123', 'UNCLEAR', 'ABCD-123'];

      const validFrames = frames.filter((text) => validateOCRResult(text, 0.85).isValid);
      expect(validFrames.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle lowercase Spanish input', () => {
      const result = validatePlateFormat('abcd-123');

      expect(result.isValid).toBe(true); // Should normalize to uppercase
    });

    it('should handle whitespace in Spanish plate', () => {
      const result = validatePlateFormat('  ABCD-123  ');

      expect(result.isValid).toBe(true); // Should trim
    });

    it('should handle lowercase European input', () => {
      const result = validatePlateFormat('ab-123-cd');

      expect(result.isValid).toBe(true); // Should normalize to uppercase
    });

    it('should handle empty string', () => {
      const result = validatePlateFormat('');

      expect(result.isValid).toBe(false);
    });

    it('should handle very long input', () => {
      const result = validatePlateFormat('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('length'))).toBe(true);
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => validatePlateFormat(null as any)).toThrow();
    });

    it('should handle mixed case input', () => {
      const result = validatePlateFormat('AbCd-123');

      expect(result.isValid).toBe(true); // Should normalize
    });
  });
});
