/**
 * Validation Domain - PHASE 6
 * Functions for validating OCR results, license plates, and confidence thresholds
 */

export interface PlateValidationResult {
  isValid: boolean;
  format: 'spain' | 'spain_historic' | 'europe' | 'unknown';
  confidence: number;
  reasons: string[];
}

export interface OCRCandidate {
  text: string;
  confidence: number;
  frame: number;
  validation: PlateValidationResult;
  selected: boolean;
  reason?: string;
}

/**
 * Regular expressions for Spanish and European plate formats
 */
const PLATE_PATTERNS = {
  // Spain (modern): NNNNLLL (4 numbers + 3 consonants)
  // Example: 1234-BCD
  spain: /^\d{4}-?[BCDFGHJKLMNPRSTVWXYZ]{3}$/,

  // Spain (legacy exported variants occasionally seen in OCR datasets)
  // Example: ABCD-123
  spain_legacy_alpha_num: /^[A-Z]{4}-?\d{3}$/,

  // Spain: Historic format NNN-LLL (3 numbers - 3 letters)
  // Example: 123-ABC
  spain_historic: /^\d{3}-?[A-Z]{3}$/,

  // Europe - Common formats:
  // Germany: 1-2 district letters + 1-2 numbers + 1-4 letters
  // Example: AB-12-XYZ or B-123-CD
  europe_germany: /^[A-Z]{1,2}-?\d{1,2}-?[A-Z]{1,4}$/,

  // France: 2 letters + 3 numbers + 2 letters (new format)
  // Example: AB-123-CD
  europe_france: /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/,

  // Italy: 2 letters + 3 numbers + 2 letters
  // Example: AB-123-CD
  europe_italy: /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/,

  // UK/Ireland: 1-2 letters + 1-3 numbers + 1-3 letters
  // Example: AB12-CDE or AB-123-CD
  europe_uk: /^[A-Z]{1,2}\d{1,3}[A-Z]{1,3}$|^[A-Z]{1,2}-?\d{1,3}-?[A-Z]{1,3}$/,

  // Poland: 3 letters + 5 numbers (old) or 2 letters + 5 numbers + 2 letters (new)
  // Example: ABC-12345 or AB-12345-CD
  europe_poland: /^[A-Z]{2,3}-?\d{5}(-?[A-Z]{2})?$/,

  // Netherlands: 2 letters + 2 numbers + 2 letters (format XX-99-XX)
  // Example: AB-12-CD
  europe_netherlands: /^[A-Z]{2}-?\d{2}-?[A-Z]{2}$/,
};

/**
 * Validate license plate format (Spain & European formats)
 */
export function validatePlateFormat(text: string): PlateValidationResult {
  const cleaned = text.toUpperCase().trim();
  const reasons: string[] = [];

  // Check length (Spanish plates: 8 chars with hyphen, European: 6-11)
  if (cleaned.length < 6 || cleaned.length > 11) {
    reasons.push(`Plate length out of bounds: ${cleaned.length} (expected 6-11 for Spain/Europe)`);
  }

  // Check for common invalid patterns
  if (/^[A-Z]{5,}/.test(cleaned)) {
    reasons.push('Plate starts with 5+ consecutive letters (unlikely for Spain/Europe)');
  }

  if (/\s{2,}/.test(cleaned)) {
    reasons.push('Plate contains multiple consecutive spaces');
  }

  // Try to match Spanish/European formats
  let format: 'spain' | 'spain_historic' | 'europe' | 'unknown' = 'unknown';
  let isValid = false;
  let detectedCountry = '';

  // Spanish formats (primary)
  if (PLATE_PATTERNS.spain.test(cleaned)) {
    format = 'spain';
    isValid = true;
    detectedCountry = 'Spain (current)';
  } else if (PLATE_PATTERNS.spain_legacy_alpha_num.test(cleaned)) {
    format = 'spain_historic';
    isValid = true;
    detectedCountry = 'Spain (legacy alpha-numeric)';
  } else if (PLATE_PATTERNS.spain_historic.test(cleaned)) {
    format = 'spain_historic';
    isValid = true;
    detectedCountry = 'Spain (historic)';
  }
  // European formats (fallback)
  else if (PLATE_PATTERNS.europe_germany.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'Germany';
  } else if (PLATE_PATTERNS.europe_france.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'France';
  } else if (PLATE_PATTERNS.europe_italy.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'Italy';
  } else if (PLATE_PATTERNS.europe_uk.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'UK/Ireland';
  } else if (PLATE_PATTERNS.europe_poland.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'Poland';
  } else if (PLATE_PATTERNS.europe_netherlands.test(cleaned)) {
    format = 'europe';
    isValid = true;
    detectedCountry = 'Netherlands';
  }

  if (!isValid) {
    reasons.push(
      `Does not match Spanish or European plate formats. Expected formats:
      - Spain: LLLL-NNN (e.g., ABCD-123)
      - Spain historic: NNN-LLL (e.g., 123-ABC)
      - Germany: 1-2 letters + 1-2 numbers + 1-4 letters
      - France/Italy: 2 letters + 3 numbers + 2 letters
      - UK/Ireland: 1-3 letters + 1-3 numbers + 1-3 letters
      - Poland: 2-3 letters + 5 numbers (+ 2 letters)
      - Netherlands: 2 letters + 2 numbers + 2 letters`
    );
  }

  return {
    isValid,
    format: isValid ? format : 'unknown',
    confidence: isValid ? 1.0 : 0.0,
    reasons: isValid && detectedCountry ? [`Detected: ${detectedCountry}`] : reasons,
  };
}

/**
 * Validate OCR confidence score
 * Threshold: 0.85 by default (85% confidence minimum)
 */
export function validateOCRConfidence(
  confidence: number,
  minConfidence: number = 0.85
): { isValid: boolean; reason?: string } {
  if (confidence < 0 || confidence > 1) {
    return { isValid: false, reason: `Confidence out of range: ${confidence}` };
  }

  if (confidence < minConfidence) {
    return {
      isValid: false,
      reason: `Confidence too low: ${(confidence * 100).toFixed(1)}% (minimum: ${(minConfidence * 100).toFixed(1)}%)`,
    };
  }

  return { isValid: true };
}

/**
 * Check if text looks like generic/placeholder content
 * Examples: "TEST", "SAMPLE", "NOPLATE", etc.
 */
export function isGenericText(text: string): boolean {
  const generic = [
    'TEST',
    'SAMPLE',
    'NOPLATE',
    'UNREADABLE',
    'OBSCURED',
    'NO_PLATE',
    'NOT_VISIBLE',
    'CENSORED',
    'BLOCKED',
  ];

  const cleaned = text.toUpperCase().trim();
  return generic.some((g) => cleaned === g || cleaned.includes(g));
}

/**
 * Check if text contains only generic symbols or incomplete data
 */
export function hasValidCharacters(text: string): boolean {
  const cleaned = text.toUpperCase().trim();

  // Should have at least one letter and one number
  const hasLetters = /[A-Z]/.test(cleaned);
  const hasNumbers = /\d/.test(cleaned);

  if (!hasLetters || !hasNumbers) {
    return false;
  }

  // Allow only alphanumeric + common separators
  const validCharsOnly = /^[A-Z0-9\s.-]+$/.test(cleaned);
  return validCharsOnly;
}

/**
 * Comprehensive OCR result validation
 */
export function validateOCRResult(
  text: string,
  confidence: number,
  minConfidence: number = 0.85
): PlateValidationResult {
  const reasons: string[] = [];

  // Check for generic/placeholder text
  if (isGenericText(text)) {
    reasons.push(`Text is generic placeholder: "${text}"`);
    return {
      isValid: false,
      format: 'unknown',
      confidence: 0,
      reasons,
    };
  }

  // Check for valid characters
  if (!hasValidCharacters(text)) {
    reasons.push(`Text contains invalid characters or missing letters/numbers: "${text}"`);
    return {
      isValid: false,
      format: 'unknown',
      confidence: 0,
      reasons,
    };
  }

  // Check confidence threshold
  const confCheck = validateOCRConfidence(confidence, minConfidence);
  if (!confCheck.isValid && confCheck.reason) {
    reasons.push(confCheck.reason);
  }

  // Validate plate format
  const formatCheck = validatePlateFormat(text);

  return {
    isValid: formatCheck.isValid && confCheck.isValid,
    format: formatCheck.format,
    confidence: confCheck.isValid ? confidence : 0,
    reasons: [...reasons, ...formatCheck.reasons],
  };
}

/**
 * Select best plate from multiple OCR candidates
 * Priority: valid format + high confidence > valid format > high confidence
 */
export function selectBestPlate(candidates: OCRCandidate[]): OCRCandidate | null {
  if (candidates.length === 0) return null;

  // Filter valid format candidates
  const validFormat = candidates.filter((c) => c.validation.isValid);
  if (validFormat.length > 0) {
    // Sort by confidence descending
    return validFormat.sort((a, b) => b.validation.confidence - a.validation.confidence)[0];
  }

  // Return null if no valid candidates (don't fallback to invalid ones)
  return null;
}

/**
 * Generate validation report for audit log
 */
export function generateValidationReport(
  candidates: OCRCandidate[],
  selected: OCRCandidate | null
): {
  totalCandidates: number;
  validCandidates: number;
  selectedText: string;
  selectedConfidence: number;
  selectedFormat: string;
  report: string;
} {
  const validCandidates = candidates.filter((c) => c.validation.isValid);

  const report = `OCR Validation Report:
- Total candidates: ${candidates.length}
- Valid format: ${validCandidates.length}
- Selected: ${selected?.text || 'NONE'}
- Confidence: ${selected ? (selected.confidence * 100).toFixed(1) + '%' : 'N/A'}
- Format: ${selected?.validation.format || 'unknown'}
${
  selected?.validation.reasons?.length
    ? '\nValidation notes:\n' + selected.validation.reasons.map((r) => `  - ${r}`).join('\n')
    : ''
}`;

  return {
    totalCandidates: candidates.length,
    validCandidates: validCandidates.length,
    selectedText: selected?.text || 'NONE',
    selectedConfidence: selected?.confidence || 0,
    selectedFormat: selected?.validation.format || 'unknown',
    report,
  };
}
