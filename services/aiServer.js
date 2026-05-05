import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  validateAuditResponse,
  validateGeometryResponse,
  scoreResponseConfidence,
  requiresManualReview,
} from './geminiResponseValidator.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

let envLoaded = false;

const stripCodeFences = (value = '') => {
  let clean = value.trim();
  if (clean.includes('```json')) {
    clean = clean.split('```json')[1].split('```')[0].trim();
  } else if (clean.includes('```')) {
    clean = clean.split('```')[1].split('```')[0].trim();
  }
  return clean;
};

export const sanitizeText = (text) => {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const loadLocalEnvFile = (cwd = process.cwd()) => {
  if (envLoaded) return;
  envLoaded = true;

  // Walk up the directory tree to find .env.local (supports git worktrees)
  let envPath = null;
  let searchDir = cwd;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(searchDir, '.env.local');
    if (fs.existsSync(candidate)) {
      envPath = candidate;
      break;
    }
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }
  if (!envPath) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const getServerApiKey = () => {
  loadLocalEnvFile();
  return process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_GENAI_KEY || '';
};

const getModelName = () => {
  loadLocalEnvFile();
  return process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
};

const getAIClient = () => {
  const apiKey = getServerApiKey();
  if (!apiKey || apiKey.trim().length < 20) {
    throw new Error('GEMINI_API_KEY no configurada en entorno servidor.');
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Estimate size of base64 image in bytes
 */
const estimateBase64Size = (base64String) => {
  return Math.ceil(base64String.length * 0.75); // base64 is ~33% larger than binary
};

/**
 * Compress image by removing data URI prefix
 */
const compressImageForAI = (base64Image) => {
  if (!base64Image) return null;
  // Remove data URI prefix if present
  return base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
};

/**
 * Select forensic evidence triplet for AI analysis.
 * Priority: use pre-computed contextSnapshots/zoomSnapshots (already selected by ForensicQueueV3
 * as entrada+crítica+salida triplets), falling back to extracting the triplet from raw snapshots.
 * Returns 3 frames max: [entrada, crítica, salida] — enough for Gemini to understand the
 * full trajectory arc without exceeding payload limits.
 */
const filterSnapshotsForAI = (snapshots = [], contextSnapshots = [], zoomSnapshots = []) => {
  // Priority 1: use pre-computed forensic triplet from context + zoom frames
  // contextSnapshots = wide-angle scene view triplet (entrada, crítica, salida)
  // zoomSnapshots    = vehicle close-up triplet for plate/detail visibility
  // We interleave them: [context_entrada, zoom_crítica, context_salida] for maximum information
  const forensicTriplet = [];
  if (contextSnapshots.length > 0) forensicTriplet.push(contextSnapshots[0]); // entrada (context)
  if (zoomSnapshots.length > 1)
    forensicTriplet.push(zoomSnapshots[Math.floor((zoomSnapshots.length - 1) / 2)]); // crítica (zoom)
  else if (contextSnapshots.length > 1)
    forensicTriplet.push(contextSnapshots[Math.floor((contextSnapshots.length - 1) / 2)]);
  if (contextSnapshots.length > 2)
    forensicTriplet.push(contextSnapshots[contextSnapshots.length - 1]); // salida (context)
  else if (zoomSnapshots.length > 0) forensicTriplet.push(zoomSnapshots[zoomSnapshots.length - 1]);

  if (forensicTriplet.length > 0) {
    return forensicTriplet.filter(Boolean).slice(0, 3);
  }

  // Priority 2: extract triplet from raw snapshots array
  if (!snapshots || snapshots.length === 0) return [];
  if (snapshots.length === 1) return [snapshots[0]];
  if (snapshots.length === 2) return [snapshots[0], snapshots[1]];

  const first = snapshots[0];
  const mid = snapshots[Math.floor((snapshots.length - 1) / 2)];
  const last = snapshots[snapshots.length - 1];
  return [first, mid, last];
};

export const generateGeometryWithGemini = async ({ directives, instruction, image }) => {
  try {
    const ai = getAIClient();
    const model = getModelName();

    const prompt = `DIRECTIVAS DE INFRACCIÓN: "${directives}". PETICIÓN ADICIONAL: "${
      instruction || 'Generación automática de geometría'
    }".

      Eres el motor geométrico de Sentinel AI. Tu misión CRÍTICA es:
      1. Crear una GEOMETRÍA DE DETECCIÓN precisa basada en las directivas y la IMAGEN adjunta.
      2. Redactar un PROTOCOLO DE SEGURIDAD técnico y detallado para el operador.

      ANÁLISIS VISUAL OBLIGATORIO:
      1. Observa la imagen proporcionada del vial.
      2. Identifica los carriles, líneas divisorias, y señales de tráfico (STOP, pasos de cebra).
      3. Coloca los vectores geométricos (x1, y1, x2, y2) EXACTAMENTE sobre las marcas viales visibles en el video.

      REGLAS DE GENERACIÓN DEL PROTOCOLO (suggestedDirectives):
      - Redacta un texto profesional en ESPAÑOL que describa qué se está vigilando.
      - Incluye las reglas que la IA debe seguir para detectar infracciones.
      - ESTO ES OBLIGATORIO. El campo suggestedDirectives no puede estar vacío.

      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1.
      - "label": Nombre corto y técnico de la zona.
      - "type": 'forbidden', 'stop_line', 'lane_divider', 'box_junction', 'pedestrian' o 'bus_lane'.

      IMPORTANTE: Adapta la geometría a la PERSPECTIVA de la cámara. Retorna solo el JSON.`;

    const parts = [{ text: prompt }];
    if (image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image,
        },
      });
    }

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Validar respuesta
    if (!result?.text) {
      throw new Error('Respuesta vacía de Gemini');
    }

    // Parsear JSON con error handling
    let data;
    try {
      const cleaned = stripCodeFences(result.text);
      data = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[GEMINI] Parse error:', parseError.message);
      console.error('[GEMINI] Raw response:', result.text?.slice(0, 200));
      throw new Error(`JSON parsing error: ${parseError.message}`);
    }

    // Validar estructura
    if (!data || typeof data !== 'object') {
      throw new Error('Respuesta de Gemini no es un objeto válido');
    }

    // 🔴 VALIDACIÓN EXHAUSTIVA DE GEOMETRY
    const validation = validateGeometryResponse(data);
    if (!validation.valid) {
      console.warn('[GEMINI_GEOMETRY_VALIDATOR] Validation errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('[GEMINI_GEOMETRY_VALIDATOR] Warnings:', validation.warnings);
    }

    const validatedLines = (data.lines || [])
      .filter(
        (line) =>
          line &&
          typeof line?.x1 === 'number' &&
          typeof line?.y1 === 'number' &&
          typeof line?.x2 === 'number' &&
          typeof line?.y2 === 'number' &&
          line.x1 >= 0 &&
          line.x1 <= 1 &&
          line.y1 >= 0 &&
          line.y1 <= 1 &&
          line.x2 >= 0 &&
          line.x2 <= 1 &&
          line.y2 >= 0 &&
          line.y2 <= 1
      )
      .map((line) => ({
        ...line,
        id: line.id || `ai_${Math.random().toString(36).slice(2, 11)}`,
      }))
      .slice(0, 15);

    // Validar que haya al menos una línea
    if (validatedLines.length === 0) {
      console.warn('[GEMINI] No valid lines extracted from response');
    }

    return {
      lines: validatedLines,
      suggestedDirectives: sanitizeText(data.suggestedDirectives || ''),
      _validationErrors: validation.errors,
      _validationWarnings: validation.warnings,
      _lineCount: validatedLines.length,
    };
  } catch (error) {
    console.error('[GEMINI] generateGeometry error:', error?.message);
    // Fallback: retornar geometría vacía en vez de fallar
    return {
      lines: [],
      suggestedDirectives: 'Error en generación automática. Requiere configuración manual.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const analyzeTrajectoryWithGemini = async ({
  track,
  line,
  directives,
  auditPreset = 'standard',
}) => {
  try {
    const ai = getAIClient();
    const model = getModelName();

    const pathVectors = (track.tail || [])
      .map((point) => `[${point.x.toFixed(3)}, ${point.y.toFixed(3)}]`)
      .join(' -> ');
    const lineVector = `(${line.x1}, ${line.y1}) to (${line.x2}, ${line.y2})`;

    const kinematics = {
      speed: `${Number(track.avgVelocity || 0).toFixed(1)} km/h`,
      heading: `${((Number(track.heading || 0) * 180) / Math.PI).toFixed(0)}deg`,
      zoneType: line.type,
      zoneName: line.label,
    };

    // Select forensic evidence triplet: entrada + crítica + salida
    // Uses pre-computed contextSnapshots/zoomSnapshots when available (set by ForensicQueueV3)
    const selectedSnapshots = filterSnapshotsForAI(
      track.snapshots || [],
      track.contextSnapshots || [],
      track.zoomSnapshots || []
    );
    const evidenceParts = selectedSnapshots
      .map((data) => {
        const compressedData = compressImageForAI(data);
        const sizeBytes = estimateBase64Size(compressedData || '');

        // Skip images larger than 5MB (Gemini has limits)
        if (sizeBytes > 5 * 1024 * 1024) {
          console.warn(
            `[GEMINI] Snapshot too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB), skipping`
          );
          return null;
        }

        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: compressedData,
          },
        };
      })
      .filter(Boolean);

    const promptText = `
    SISTEMA DE ANÁLISIS DE TRAYECTORIA - SENTINEL AI

    OBJETIVO: Analizar matemáticamente la trayectoria del vehículo para confirmar ÚNICAMENTE la infracción definida por el protocolo activo y la geometría proporcionada.

    DATOS DEL VECTOR:
    - TRAYECTORIA (Normalizada 0-1): ${pathVectors}
    - GEOMETRÍA A VIGILAR: ${lineVector} -- TIPO: ${kinematics.zoneType} (${kinematics.zoneName})
    - CINEMÁTICA: Velocidad ${kinematics.speed}, Dirección ${kinematics.heading}.
    - PRESET DE AUDITORÍA: ${auditPreset}
    - SECUENCIA DE IMÁGENES: ${selectedSnapshots.length} fotograma(s) forense(s) adjuntos — [ENTRADA → CRÍTICA → SALIDA]. Cada imagen representa un instante clave de la maniobra.

    DIRECTIVAS VIGENTES: "${directives}"
    CONTEXTO DE REGLA: "${line.analysisContext || 'Sin contexto adicional.'}"

    RESTRICCIÓN CRÍTICA DE ALCANCE:
    - SOLO puedes confirmar o descartar la infracción descrita por la GEOMETRÍA A VIGILAR y las DIRECTIVAS VIGENTES.
    - NO inventes ni sustituyas la infracción por otra diferente aunque visualmente parezca existir otra posible falta.
    - Si la evidencia no confirma ESA infracción concreta, responde "infraction": false.
    - "ruleCategory" debe corresponder a ${kinematics.zoneName}.
    - "legalBase" debe referirse únicamente a la base legal aplicable a esa infracción concreta o indicar "Revisión Manual" si no está clara.
    ${
      line.violationKind === 'forbidden_turn_sequence'
        ? `- ESTA REGLA ES EXPLÍCITA: si el mismo vehículo recorrió la secuencia ${
            line.roiSequenceLabels?.join(' -> ') || 'ROI A -> ROI B'
          }, la infracción a evaluar es GIRO PROHIBIDO. No la reclasifiques como otra maniobra.`
        : ''
    }

    ANÁLISIS REQUERIDO:
    1. Observa la secuencia de imágenes y la lista de puntos de la trayectoria.
    2. Determina si el vector de movimiento CRUZÓ o VIOLÓ exactamente la geometría prohibida definida arriba.
    3. Analiza la INTENCIONALIDAD basada en la curva de movimiento.

    REGLAS DE DECISIÓN:
    - Si es STOP: ¿La velocidad llegó a 0 o cerca de 0 en la zona de la línea?
    - Si es LÍNEA CONTINUA: ¿Los vectores cruzan de un lado a otro de la línea definida?
    - Si es DIRECCIÓN PROHIBIDA: ¿El ángulo de movimiento es opuesto al permitido?
    - Si la regla es una secuencia ROI de giro prohibido: confirma si el mismo track aparece en todas las ROI requeridas en el orden indicado.

    OUTPUT JSON (Estricto):
    {
      "infraction": boolean,
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "ruleCategory": "TRAJECTORY_VIOLATION",
      "description": "Explicación técnica basada en el análisis vectorial y visual.",
      "plate": "Lectura OCR o DESCONOCIDO",
      "makeModel": "Identificación visual",
      "color": "Color visual",
      "videoTimeCode": "Timestamp exacto visible en el OSD del video (ej: '12-11-2025 12:47:56')",
      "legalBase": "Artículo RGC aplicable según directiva",
      "reasoning": ["Punto A cruza Punto B", "Velocidad no disminuye", "Trayectoria invade carril"],
      "telemetry": {
        "speedEstimated": "${kinematics.speed}",
        "behaviorAnomalies": "Anomalías en vectores"
      }
    }
  `;

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [...evidenceParts, { text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Validar respuesta
    if (!result?.text) {
      throw new Error('Respuesta vacía de Gemini para análisis de trayectoria');
    }

    // Parsear JSON con error handling
    let rawData;
    try {
      const cleaned = stripCodeFences(result.text);
      rawData = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[GEMINI] Parse error en analyzeTrajectory:', parseError.message);
      console.error('[GEMINI] Raw response:', result.text?.slice(0, 200));
      throw new Error(`JSON parsing error: ${parseError.message}`);
    }

    // 🔴 VALIDACIÓN EXHAUSTIVA DE RESPUESTA GEMINI
    const validation = validateAuditResponse(rawData);
    if (!validation.valid) {
      console.warn('[GEMINI_VALIDATOR] Validation errors:', validation.errors);
      console.warn('[GEMINI_VALIDATOR] Warnings:', validation.warnings);
      // Si hay errores críticos, marcar para revisión manual
      rawData._validationErrors = validation.errors;
      rawData._validationWarnings = validation.warnings;
      rawData._requiresManualReview = true;
    }

    // Calcular confidence score
    const confidenceScore = scoreResponseConfidence(rawData, selectedSnapshots, track);
    rawData._confidenceScore = confidenceScore;
    rawData._requiresManualReview =
      rawData._requiresManualReview || requiresManualReview(rawData, confidenceScore);

    if (confidenceScore < 0.7) {
      console.warn(`[GEMINI_CONFIDENCE] Low confidence score: ${confidenceScore.toFixed(2)}`);
    }

    const response = {
      infraction: rawData.infraction === true,
      plate: sanitizeText(rawData.plate || 'DESCONOCIDO'),
      makeModel: sanitizeText(rawData.makeModel || 'DESCONOCIDO'),
      color: sanitizeText(rawData.color || 'DESCONOCIDO'),
      videoTimeCode: sanitizeText(rawData.videoTimeCode || ''),
      description: sanitizeText(rawData.description || 'Análisis de trayectoria completado'),
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawData.severity)
        ? rawData.severity
        : 'LOW',
      ruleCategory: sanitizeText(rawData.ruleCategory || line.label || 'TRAJECTORY'),
      legalBase: sanitizeText(rawData.legalBase || 'Revisión Manual'),
      reasoning: Array.isArray(rawData.reasoning)
        ? rawData.reasoning.map((r) => sanitizeText(String(r)))
        : [],
      visualTimestamp: new Date().toLocaleTimeString(),
      telemetry: {
        speedEstimated: rawData.telemetry?.speedEstimated || kinematics.speed,
        behaviorAnomalies: sanitizeText(rawData.telemetry?.behaviorAnomalies || 'None'),
      },
      // 🔴 AGREGACIONES PARA CONTROL DE CALIDAD
      _validationErrors: validation.errors,
      _validationWarnings: validation.warnings,
      _confidenceScore: confidenceScore,
      _requiresManualReview: rawData._requiresManualReview,
    };

    return response;
  } catch (error) {
    console.error('[GEMINI] analyzeTrajectory error:', error?.message);
    // Fallback: retornar análisis vacío marcando para revisión manual
    return {
      infraction: false,
      plate: 'DESCONOCIDO',
      makeModel: 'DESCONOCIDO',
      color: 'DESCONOCIDO',
      videoTimeCode: '',
      description: 'Error en análisis automático. Requiere revisión manual.',
      severity: 'MEDIUM',
      ruleCategory: 'MANUAL_REVIEW',
      legalBase: 'Revisión Manual',
      reasoning: ['Error en análisis de trayectoria automático'],
      visualTimestamp: new Date().toLocaleTimeString(),
      telemetry: {
        speedEstimated: '0.0 km/h',
        behaviorAnomalies: 'Análisis fallido',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Extract license plate from multiple images for maximum accuracy.
 * Tries all images and returns the highest confidence result.
 */
export const extractLicensePlateFromMultiple = async (base64Images = []) => {
  try {
    if (!base64Images || base64Images.length === 0) {
      return { plate: 'NO_IMAGES', confidence: 0 };
    }

    loadLocalEnvFile();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { plate: 'NO_API_KEY', confidence: 0 };
    }

    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });

    let bestResult = { plate: 'NO_PLATE', confidence: 0 };

    // Process each image and keep best result
    for (const base64Image of base64Images) {
      if (!base64Image) continue;

      try {
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await model.generateContent([
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData,
            },
          },
          {
            text: 'Extract ONLY the license plate number from this image. Return JSON: {"plate": "XXXXX", "confidence": 0.95}. If no plate visible: {"plate": "NO_PLATE", "confidence": 0}.',
          },
        ]);

        const responseText = response.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          const plate = String(result.plate || 'NO_PLATE').toUpperCase();
          const confidence = Number(result.confidence) || 0;

          // Keep best result
          if (plate !== 'NO_PLATE' && confidence > bestResult.confidence) {
            bestResult = { plate, confidence };
          }
        }
      } catch (err) {
        console.warn('[Gemini OCR] Error processing image:', err.message);
        continue;
      }
    }

    return bestResult;
  } catch (error) {
    console.error('[Gemini OCR Multi] Error:', error);
    return { plate: 'ERROR', confidence: 0 };
  }
};

/**
 * Extract license plate from single image using Gemini Vision API.
 * Used as fallback for single image OCR.
 */
export const extractLicensePlateWithGemini = async (base64Image) => {
  return extractLicensePlateFromMultiple([base64Image]);
};

/**
 * Extract timestamp from OSD (On-Screen Display) in video.
 * Reads date/time from top-left corner and converts to ISO timestamp.
 * Supports various formats: DD-MM-YYYY HH:MM:SS, YYYY-MM-DD HH:MM:SS, etc.
 */
export const extractTimestampFromOSD = async (base64Image) => {
  try {
    if (!base64Image) {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    loadLocalEnvFile();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });

    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      },
      {
        text: `TASK: Extract the date and time from the video's on-screen display (OSD).

LOCATION: Look in the top-left, top-right, bottom-left, or bottom-right corner for date/time text.

FORMATS: Look for patterns like:
  - DD-MM-YYYY HH:MM:SS
  - DD/MM/YYYY HH:MM:SS
  - DD-MM-YY HH:MM:SS
  - YYYY-MM-DD HH:MM:SS
  - Any visible numeric date and time pattern

EXTRACTION:
1. First, identify the EXACT text you see in the OSD (numbers, separators, everything)
2. Then format it as DD-MM-YYYY HH:MM:SS if possible

RESPONSE: Return ONLY valid JSON:
{
  "timestamp": "DD-MM-YYYY HH:MM:SS",
  "confidence": 0.8
}

If no timestamp found:
{
  "timestamp": null,
  "confidence": 0
}

CRITICAL: Be extremely precise - extract EXACTLY what you see.`,
      },
    ]);

    const responseText = response.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    const result = JSON.parse(jsonMatch[0]);
    // Gemini returns 'timestamp' field with the extracted date/time
    const osdText = String(result.timestamp || '').trim();
    const confidence = Number(result.confidence) || 0;

    if (!osdText || osdText === 'null') {
      return { timestamp: null, osdText: null, confidence: 0 };
    }

    // Parse various timestamp formats
    const parsedTimestamp = parseOSDTimestamp(osdText);

    return {
      timestamp: parsedTimestamp,
      osdText,
      confidence,
    };
  } catch (error) {
    console.error('[Gemini OSD] Error extracting timestamp:', error);
    return { timestamp: null, osdText: null, confidence: 0 };
  }
};

/**
 * Parse OSD timestamp in various formats
 * Supports: DD-MM-YYYY HH:MM:SS, YYYY-MM-DD HH:MM:SS, etc.
 */
const parseOSDTimestamp = (osdText) => {
  if (!osdText) return null;

  try {
    // Common formats: DD-MM-YYYY HH:MM:SS or YYYY-MM-DD HH:MM:SS
    let date;

    // Try DD-MM-YYYY HH:MM:SS format
    let match = osdText.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const hours = parseInt(match[4], 10);
      const minutes = parseInt(match[5], 10);
      const seconds = parseInt(match[6], 10);

      // Check if it's DD-MM-YYYY (day > 12) or MM-DD-YYYY (day <= 12)
      if (day > 12) {
        date = new Date(year, month - 1, day, hours, minutes, seconds);
      } else {
        // Ambiguous, assume DD-MM-YYYY for safety
        date = new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }

    // Try YYYY-MM-DD HH:MM:SS format
    if (!date) {
      match = osdText.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        const hours = parseInt(match[4], 10);
        const minutes = parseInt(match[5], 10);
        const seconds = parseInt(match[6], 10);

        date = new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }

    if (date && !isNaN(date.getTime())) {
      return date.toISOString();
    }

    return null;
  } catch (err) {
    console.warn('[OSD Parser] Error parsing timestamp:', osdText, err.message);
    return null;
  }
};
