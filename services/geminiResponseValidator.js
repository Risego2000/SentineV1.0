/**
 * Gemini Response Validator
 * Validates AI responses to ensure quality, consistency, and legality
 */

import { logger } from './logger.ts';

/**
 * Validate audit response from Gemini
 * Ensures response has correct structure and values
 */
export function validateAuditResponse(response) {
  const errors = [];
  const warnings = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object');
    return { valid: false, errors, warnings, score: 0 };
  }

  // REQUIRED FIELDS
  const requiredFields = [
    'infraction',
    'severity',
    'ruleCategory',
    'description',
    'legalBase',
    'reasoning',
    'telemetry',
  ];

  for (const field of requiredFields) {
    if (!(field in response)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // VALIDATE TYPES
  if (typeof response.infraction !== 'boolean') {
    errors.push(`infraction must be boolean, got ${typeof response.infraction}`);
  }

  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(response.severity)) {
    errors.push(`severity must be LOW|MEDIUM|HIGH|CRITICAL, got "${response.severity}"`);
  }

  if (!Array.isArray(response.reasoning)) {
    errors.push('reasoning must be an array');
  }

  // VALIDATE PLATE FORMAT
  if (response.plate && response.plate !== 'UNKNOWN' && response.plate !== 'NO_IMAGES') {
    // Spanish license plate regex
    const plateRegex =
      /^(\d{4}[A-Z]{3}|N\d{4}[A-Z]{3}|H\d{4}[A-Z]{3}|C\d{4}[A-Z]{3}|CD|CC|[A-Z]{2}\d{4}[A-Z]{2})$/;
    if (!plateRegex.test(response.plate)) {
      warnings.push(`Plate "${response.plate}" does not match expected Spanish format`);
    }
  }

  // VALIDATE TIMESTAMP FORMAT
  if (response.videoTimeCode) {
    const timecodeRegex = /^\d{1,2}:\d{2}:\d{2}$/;
    if (!timecodeRegex.test(response.videoTimeCode)) {
      warnings.push(
        `videoTimeCode "${response.videoTimeCode}" has invalid format (expected HH:MM:SS)`
      );
    }
  }

  // VALIDATE DESCRIPTION
  if (response.description && typeof response.description === 'string') {
    if (response.description.length < 10) {
      warnings.push('Description is very short (<10 chars)');
    }
    if (response.description.length > 1000) {
      errors.push('Description too long (>1000 chars)');
    }
  }

  // VALIDATE REASONING
  if (Array.isArray(response.reasoning)) {
    if (response.reasoning.length === 0) {
      warnings.push('Reasoning array is empty');
    }
    for (const reason of response.reasoning) {
      if (typeof reason !== 'string' || reason.length < 5) {
        errors.push(`Invalid reasoning entry: "${reason}"`);
      }
    }
  }

  // CONSISTENCY CHECK
  // If infraction=false, severity should be LOW or undefined
  if (!response.infraction && response.severity && response.severity !== 'LOW') {
    warnings.push(`Inconsistency: infraction=false but severity=${response.severity}`);
  }

  // If infraction=true with CRITICAL severity, ensure plate is valid
  if (response.infraction && response.severity === 'CRITICAL') {
    if (!response.plate || response.plate === 'UNKNOWN') {
      warnings.push('Critical infraction detected but plate is unknown');
    }
  }

  // Check for hallucinations (common patterns)
  const hallucinations = detectHallucinations(response);
  if (hallucinations.length > 0) {
    warnings.push(`Potential hallucinations detected: ${hallucinations.join(', ')}`);
  }

  // CALCULATE CONFIDENCE SCORE (0-1)
  let score = 1.0;
  score -= errors.length * 0.3; // Each error: -0.3
  score -= warnings.length * 0.1; // Each warning: -0.1
  score = Math.max(0, Math.min(1, score));

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    score,
    requiresManualReview: score < 0.7 || response.infraction === undefined,
  };
}

/**
 * Detect common hallucinations in Gemini responses
 */
function detectHallucinations(response) {
  const hallucinations = [];

  if (!response.legalBase) {
    return hallucinations;
  }

  // Spanish traffic code articles (Código de la Circulación)
  const validArticles = [
    '32',
    '34',
    '35',
    '36',
    '37',
    '38',
    '39',
    '40',
    '41',
    '42',
    '43',
    '44',
    '45',
    '47',
    '48',
    '49',
    '50',
    '51',
    '52',
    '54',
    '55',
    '56',
    '57',
    '58',
    '59',
    '60',
    '61',
    '62',
    '63',
    '64',
    '65',
    '66',
    '67',
    '68',
    '69',
    '70',
    '71',
  ];

  // Check if article number is reasonable
  const articleMatch = response.legalBase.match(/Artículo\s+(\d+)/i);
  if (articleMatch && !validArticles.includes(articleMatch[1])) {
    hallucinations.push(`Article ${articleMatch[1]} may be invalid`);
  }

  // Check for impossible infractions
  if (response.description) {
    const desc = response.description.toLowerCase();

    // Example: impossible cases
    if (desc.includes('velocidad') && desc.includes('parado')) {
      hallucinations.push('Speed violation while stationary');
    }
    if (desc.includes('sentido prohibido') && desc.includes('carril ciclomovilista')) {
      hallucinations.push('Wrong direction in bicycle lane');
    }
  }

  return hallucinations;
}

/**
 * Validate geometry response from Gemini
 */
export function validateGeometryResponse(response) {
  const errors = [];
  const warnings = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object');
    return { valid: false, errors, warnings };
  }

  // Must have lines array
  if (!Array.isArray(response.lines)) {
    errors.push('Response must have "lines" array');
    return { valid: false, errors, warnings };
  }

  // Max lines validation
  if (response.lines.length > 15) {
    errors.push(`Too many lines: ${response.lines.length} (max 15)`);
  }

  if (response.lines.length === 0) {
    warnings.push('No geometry lines detected');
  }

  // Validate each line
  for (let i = 0; i < response.lines.length; i++) {
    const line = response.lines[i];

    if (
      line.x1 === undefined ||
      line.y1 === undefined ||
      line.x2 === undefined ||
      line.y2 === undefined
    ) {
      errors.push(`Line ${i}: missing coordinates`);
      continue;
    }

    // Coordinates must be 0-1 (normalized)
    for (const coord of [line.x1, line.y1, line.x2, line.y2]) {
      if (typeof coord !== 'number' || coord < 0 || coord > 1) {
        errors.push(`Line ${i}: coordinate ${coord} out of bounds [0,1]`);
      }
    }

    // Label and type required
    if (!line.label) {
      errors.push(`Line ${i}: missing label`);
    }
    if (!line.type) {
      errors.push(`Line ${i}: missing type`);
    }

    // Validate type
    const validTypes = [
      'forbidden',
      'stop_line',
      'lane_divider',
      'box_junction',
      'pedestrian',
      'bus_lane',
      'roi_general',
      'roi_turn',
    ];
    if (line.type && !validTypes.includes(line.type)) {
      warnings.push(`Line ${i}: unknown type "${line.type}"`);
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    lineCount: response.lines.length,
  };
}

/**
 * Confidence scoring for responses
 * Combines multiple factors into 0-1 score
 */
export function scoreResponseConfidence(audit, snapshots, track) {
  let score = 0.5; // baseline

  // FACTOR 1: Validation score (if available)
  if (audit._validationScore) {
    score = audit._validationScore * 0.3; // 30% weight
  }

  // FACTOR 2: Image quality (if available)
  if (snapshots && snapshots.length > 0) {
    // Assume better with more snapshots
    const imageQualityBonus = Math.min(0.2, snapshots.length * 0.05); // +0.05 per image, max 0.2
    score += imageQualityBonus;
  }

  // FACTOR 3: OCR confidence (if available)
  if (audit.plateOcrConfidence) {
    if (audit.plateOcrConfidence > 0.8) {
      score += 0.15;
    } else if (audit.plateOcrConfidence > 0.6) {
      score += 0.05;
    } else if (audit.plateOcrConfidence < 0.5) {
      score -= 0.1;
    }
  }

  // FACTOR 4: Behavior anomaly detection
  if (track && track.isAnomalous) {
    score += 0.1;
  }

  // FACTOR 5: Reasoning quality
  if (audit.reasoning && Array.isArray(audit.reasoning)) {
    if (audit.reasoning.length >= 3) {
      score += 0.1;
    } else if (audit.reasoning.length === 0) {
      score -= 0.2;
    }
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * Determine if response requires manual review
 */
export function requiresManualReview(audit, confidenceScore) {
  // Always require manual review if:
  return (
    // 1. Low confidence
    confidenceScore < 0.7 ||
    // 2. Reasoning indicates uncertainty
    (audit.reasoning &&
      audit.reasoning.some(
        (r) =>
          r.includes('UNCERTAIN') ||
          r.includes('AMBIGUOUS') ||
          r.includes('UNCLEAR') ||
          r.includes('NO SE') ||
          r.includes('possibly') ||
          r.includes('might be')
      )) ||
    // 3. Missing critical data
    !audit.plate ||
    audit.plate === 'UNKNOWN' ||
    // 4. Edge case violations
    (audit.infraction && !audit.severity) ||
    // 5. Conflicting fields
    (!audit.infraction && audit.severity !== 'LOW')
  );
}

export default {
  validateAuditResponse,
  validateGeometryResponse,
  scoreResponseConfidence,
  requiresManualReview,
};
