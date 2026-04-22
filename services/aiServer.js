import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

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

    const validatedLines = (data.lines || [])
      .filter((line) =>
        line &&
        typeof line?.x1 === 'number' &&
        typeof line?.y1 === 'number' &&
        typeof line?.x2 === 'number' &&
        typeof line?.y2 === 'number' &&
        line.x1 >= 0 && line.x1 <= 1 &&
        line.y1 >= 0 && line.y1 <= 1 &&
        line.x2 >= 0 && line.x2 <= 1 &&
        line.y2 >= 0 && line.y2 <= 1
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

    const evidenceParts = (track.snapshots || []).map((data) => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data,
      },
    }));

    const promptText = `
    SISTEMA DE ANÁLISIS DE TRAYECTORIA - SENTINEL AI

    OBJETIVO: Analizar matemáticamente la trayectoria del vehículo para confirmar ÚNICAMENTE la infracción definida por el protocolo activo y la geometría proporcionada.

    DATOS DEL VECTOR:
    - TRAYECTORIA (Normalizada 0-1): ${pathVectors}
    - GEOMETRÍA A VIGILAR: ${lineVector} -- TIPO: ${kinematics.zoneType} (${kinematics.zoneName})
    - CINEMÁTICA: Velocidad ${kinematics.speed}, Dirección ${kinematics.heading}.
    - PRESET DE AUDITORÍA: ${auditPreset}

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

    // Validar estructura
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('Respuesta de Gemini no es un objeto válido');
    }

    return {
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
      reasoning: Array.isArray(rawData.reasoning) ? rawData.reasoning.map(r => sanitizeText(String(r))) : [],
      visualTimestamp: new Date().toLocaleTimeString(),
      telemetry: {
        speedEstimated: rawData.telemetry?.speedEstimated || kinematics.speed,
        behaviorAnomalies: sanitizeText(rawData.telemetry?.behaviorAnomalies || 'None'),
      },
    };
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
