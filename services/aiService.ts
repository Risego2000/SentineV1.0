import { GoogleGenAI, Part } from '@google/genai';
import { GeometryLine, Track, AuditResponse, AuditPresetType } from '../types';
import { logger } from './logger';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const getModelName = (): string => {
  return import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
};

/**
 * Service specifically designed for communication with Google Gemini AI models.
 * Implements security validation, content sanitization, and structured output parsing.
 */
const getAIClient = (): GoogleGenAI => {
  const apiKey = import.meta.env.VITE_GOOGLE_GENAI_KEY;

  if (!apiKey || apiKey.trim().length < 20) {
    throw new Error(
      'SENTINEL_CRITICAL: API Key de Gemini no detectada. Configura VITE_GOOGLE_GENAI_KEY en .env.local.'
    );
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Sanitizes text to prevent basic XSS and injection.
 */
export const sanitizeText = (text: string): string => {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export interface GeometryResponse {
  lines: GeometryLine[];
  suggestedDirectives: string;
}

export const AIService = {
  /**
   * Sentinel AI Geometric Engine.
   * Analyzes road layout and generates detection geometries.
   */
  async generateGeometry(
    directives: string,
    instruction?: string,
    image?: string
  ): Promise<GeometryResponse> {
    const ai = getAIClient();
    const model = getModelName();

    const prompt = `DIRECTIVAS DE INFRACCIÓN: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Generación automática de geometría'}". 
      
      Eres el motor geométrico de Sentinel AI. Tu misión CRÍTICA es:
      1. Crear una GEOMETRÍA DE DETECCIÓN precisa basada en las directivas y la IMAGEN adjunta.
      2. Redactar un PROTOCOLO DE SEGURIDAD técnico y detallado para el operador.
      
      ANÁLISIS VISUAL OBLIGATORIO:
      1. Observa la imagen proporcionada del vial.
      2. Identifica los carriles, líneas divisorias, y señales de tráfico (STOP, pasos de cebra).
      3. Coloca los vectores geométricos (x1, y1, x2, y2) EXACTAMENTE sobre las marcas viales visibles en el video.
      
      REGLAS DE GENERACIÓN DEL PROTOCOLO (suggestedDirectives):
      - Redacta un texto profesional en ESPAÑOL que describa qué se está vigilando (ej: "Vigilancia de carril BUS en Calle Real", "Control de STOP en intersección M-113").
      - Incluye las reglas que la IA debe seguir para detectar infracciones.
      - ESTO ES OBLIGATORIO. El campo suggestedDirectives no puede estar vacío.
      
      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1.
      - "label": Nombre corto y técnico de la zona.
      - "type": 'forbidden', 'stop_line', 'lane_divider', 'box_junction', 'pedestrian' o 'bus_lane'.
      
      IMPORTANTE: Adapta la geometría a la PERSPECTIVA de la cámara. Retorna solo el JSON.`;

    const parts: Part[] = [{ text: prompt }];
    if (image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image,
        },
      });
    }

    try {
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
      const responseText = result.text;

      let cleanJson = responseText.trim();
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
      } else if (cleanJson.includes('```')) {
        cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
      }

      const data = JSON.parse(cleanJson);
      const validatedLines = (data.lines || [])
        .filter(
          (l: { x1: number; y1: number }) =>
            typeof l.x1 === 'number' && !isNaN(l.x1) && typeof l.y1 === 'number' && !isNaN(l.y1)
        )
        .map((l: GeometryLine) => ({
          ...l,
          id: l.id || `ai_${Math.random().toString(36).substring(2, 11)}`,
        }))
        .slice(0, 15) as GeometryLine[];

      return {
        lines: validatedLines,
        suggestedDirectives: sanitizeText(data.suggestedDirectives || ''),
      };
    } catch (e) {
      logger.error('AI_SERVICE', 'Error en generación de geometría', e);
      throw new Error('Respuesta de IA con formato incorrecto');
    }
  },

  /**
   * SUPREME FORENSIC AUDITOR of SENTINEL.AI v.1.0
   * Judicial Expert Unit - Daganzo de Arriba (Madrid).
   */
  /**
   * TRAJECTORY ANALYSIS ENGINE (New Forensic System)
   * Analyzes vehicle path vectors against road geometry to determine infractions.
   */
  async analyzeTrajectory(
    track: Track,
    line: GeometryLine,
    directives: string,
    auditPreset: AuditPresetType = 'standard'
  ): Promise<AuditResponse> {
    const ai = getAIClient();
    const model = getModelName();

    // 1. Prepare Trajectory Data
    const pathVectors = track.tail
      .map((p) => `[${p.x.toFixed(3)}, ${p.y.toFixed(3)}]`)
      .join(' -> ');
    const lineVector = `(${line.x1}, ${line.y1}) to (${line.x2}, ${line.y2})`;

    // 2. Prepare Context (Snapshots + Kinematics)
    const kinematics = {
      speed: track.avgVelocity.toFixed(1) + ' km/h',
      vectors: pathVectors.length,
      heading: ((track.heading * 180) / Math.PI).toFixed(0) + 'deg',
      zoneType: line.type,
      zoneName: line.label,
    };

    const evidenceParts: Part[] = track.snapshots.map((data) => ({
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
      
      RESTRICCIÓN CRÍTICA DE ALCANCE:
      - SOLO puedes confirmar o descartar la infracción descrita por la GEOMETRÍA A VIGILAR y las DIRECTIVAS VIGENTES.
      - NO inventes ni sustituyas la infracción por otra diferente aunque visualmente parezca existir otra posible falta.
      - Si la evidencia no confirma ESA infracción concreta, responde "infraction": false.
      - "ruleCategory" debe corresponder a ${kinematics.zoneName}.
      - "legalBase" debe referirse únicamente a la base legal aplicable a esa infracción concreta o indicar "Revisión Manual" si no está clara.

      ANÁLISIS REQUERIDO:
      1. Observa la secuencia de imágenes y la lista de puntos de la trayectoria.
      2. Determina si el vector de movimiento CRUZÓ o VIOLÓ exactamente la geometría prohibida definida arriba.
      3. Analiza la INTENCIONALIDAD basada en la curva de movimiento (ej: cambio brusco vs deriva).
      
      REGLAS DE DECISIÓN:
      - Si es STOP: ¿La velocidad llegó a 0 o cerca de 0 en la zona de la línea?
      - Si es LÍNEA CONTINUA: ¿Los vectores cruzan de un lado a otro de la línea definida?
      - Si es DIRECCIÓN PROHIBIDA: ¿El ángulo de movimiento es opuesto al permitido?
      
      OUTPUT JSON (Estricto):
      {
        "infraction": boolean,
        "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        "ruleCategory": "TRAJECTORY_VIOLATION",
        "description": "Explicación técnica basada en el análisis vectorial y visual.",
        "plate": "Lectura OCR o DESCONOCIDO",
        "makeModel": "Identificación visual",
        "color": "Color visual",
        "legalBase": "Artículo RGC aplicable según directiva",
        "reasoning": ["Punto A cruza Punto B", "Velocidad no disminuye", "Trayectoria invade carril"],
        "telemetry": {
          "speedEstimated": "${kinematics.speed}",
          "behaviorAnomalies": "Anomalías en vectores"
        }
      }
    `;

    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [...evidenceParts, { text: promptText }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = result.text;
      let cleanJson = responseText.trim();
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
      } else if (cleanJson.includes('```')) {
        cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
      }

      const rawData = JSON.parse(cleanJson);

      return {
        infraction: rawData.infraction,
        plate: sanitizeText(rawData.plate || 'DESCONOCIDO'),
        makeModel: sanitizeText(rawData.makeModel || 'DESCONOCIDO'),
        color: sanitizeText(rawData.color || 'DESCONOCIDO'),
        description: sanitizeText(rawData.description || 'Análisis de trayectoria completado'),
        severity: rawData.severity || 'LOW',
        ruleCategory: sanitizeText(rawData.ruleCategory || line.label || 'TRAJECTORY'),
        legalBase: sanitizeText(rawData.legalBase || 'Revisión Manual'),
        reasoning: rawData.reasoning || [],
        visualTimestamp: new Date().toLocaleTimeString(),
        telemetry: {
          speedEstimated: rawData.telemetry?.speedEstimated || kinematics.speed,
          behaviorAnomalies: rawData.telemetry?.behaviorAnomalies || 'None',
        },
      };
    } catch (e) {
      logger.error('AI_TRAJECTORY', 'Error analizando trayectoria', e);
      throw e;
    }
  },
};
