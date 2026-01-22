import { GoogleGenAI, Type } from "@google/genai";
import { GeometryLine, Track } from "../types";
import { logger } from "./logger";
import { AUDIT_PRESETS, AuditPresetType } from "../constants";

/**
 * Servicio encargado de la comunicación con los modelos de IA de Google Gemini.
 * Implementa validación de seguridad y sanitización de contenido.
 */
const getAIClient = () => {
    const apiKey = (import.meta as any).env.VITE_GOOGLE_GENAI_KEY;
    if (!apiKey) {
        logger.error('AI_SERVICE', 'Falta la API Key de Gemini (VITE_GOOGLE_GENAI_KEY)');
        throw new Error("API Key missing");
    }
    return new GoogleGenAI(apiKey);
};

/**
 * Sanitiza texto para prevenir inyección de scripts básicos (XSS).
 */
export const sanitizeText = (text: string): string => {
    return (text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

export interface GeometryResponse {
    lines: GeometryLine[];
    suggestedDirectives: string;
}

export const AIService = {
    /**
     * Motor Geométrico de Sentinel AI.
     */
    async generateGeometry(directives: string, instruction?: string, image?: string): Promise<GeometryResponse> {
        const genAI = getAIClient();
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lines: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    x1: { type: Type.NUMBER },
                                    y1: { type: Type.NUMBER },
                                    x2: { type: Type.NUMBER },
                                    y2: { type: Type.NUMBER },
                                    label: { type: Type.STRING },
                                    type: { type: Type.STRING }
                                },
                                required: ["x1", "y1", "x2", "y2", "label", "type"]
                            }
                        },
                        suggestedDirectives: { type: Type.STRING }
                    },
                    required: ["lines", "suggestedDirectives"]
                }
            }
        });

        const prompt = `DIRECTIVAS DE INFRACCIÓN: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Generación automática de geometría'}". 
      
      Eres el motor geométrico de Sentinel AI. Tu misión CRÍTICA es crear una geometría de detección precisa basada en las directivas de infracción proporcionadas y la IMAGEN DE LA ESCENA adjunta.
      
      ANÁLISIS VISUAL OBLIGATORIO:
      1. Observa la imagen proporcionada del vial.
      2. Identifica los carriles, líneas divisorias, y señales de tráfico (STOP, pasos de cebra).
      3. Coloca los vectores geométricos (x1, y1, x2, y2) EXACTAMENTE sobre las marcas viales visibles en el video.
      4. Si las directivas piden "Cruce Línea Continua", traza líneas 'lane_divider' sobre las líneas reales de la carretera.
      5. Si piden "STOP", coloca la 'stop_line' sobre la línea de detención real.
      
      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1 respecto a la imagen (0,0 es arriba-izquierda, 1,1 abajo-derecha).
      - "label": Nombre corto y técnico de la zona.
      - "type": 'forbidden', 'stop_line', 'lane_divider', 'box_junction', 'pedestrian' o 'bus_lane'.
      
      IMPORTANTE: Adapta la geometría a la PERSPECTIVA de la cámara en el video. No asumas que la carretera es horizontal.
      
      RETORNA ÚNICAMENTE EL JSON.`;

        const parts: any[] = [{ text: prompt }];
        if (image) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: image
                }
            });
        }

        try {
            const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
            const response = result.response;
            const responseText = response.text();

            let cleanJson = responseText.trim();
            if (cleanJson.includes("```json")) {
                cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
            } else if (cleanJson.includes("```")) {
                cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
            }

            const data = JSON.parse(cleanJson);
            const validatedLines = (data.lines || [])
                .filter((l: any) =>
                    typeof l.x1 === 'number' && !isNaN(l.x1) &&
                    typeof l.y1 === 'number' && !isNaN(l.y1)
                )
                .map((l: any) => ({
                    ...l,
                    id: l.id || `ai_${Math.random().toString(36).substr(2, 9)}`
                }))
                .slice(0, 15) as GeometryLine[];

            return {
                lines: validatedLines,
                suggestedDirectives: sanitizeText(data.suggestedDirectives || "")
            };
        } catch (e) {
            logger.error("AI_SERVICE", "Error en generación de geometría", e);
            throw new Error("Respuesta de IA con formato incorrecto");
        }
    },

    /**
     * AUDITOR FORENSE SUPREMO de SENTINEL.AI v.1.0
     * Unidad de Peritaje Judicial - Daganzo de Arriba (Madrid).
     */
    async runAudit(track: Track, line: GeometryLine, directives: string, auditPreset: AuditPresetType = 'standard') {
        const genAI = getAIClient();
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const presetInfo = AUDIT_PRESETS[auditPreset];

        // Resumen cinemático preciso (Capa Edge)
        const kinematicData = {
            velocityKmH: track.avgVelocity.toFixed(1) + " km/h",
            acceleration: (track.acceleration * 100).toFixed(4),
            heading: (track.heading * 180 / Math.PI).toFixed(2) + "°",
            dwellTime: (track.dwellTime / 1000).toFixed(2) + "s",
            trajectoryPoints: track.tail.length,
            label: track.label,
            isAnomalous: track.isAnomalous ? 'SÍ' : 'NO'
        };

        const evidenceParts = track.snapshots.map((data) => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data
            }
        }));

        const promptText = `Eres el AUDITOR FORENSE SUPREMO de SENTINEL.AI v.1.0, el sistema de infraestructura forense neural de última generación desplegado por la Policía Local de Daganzo de Arriba (Madrid).
                      
                      CONTEXTO TÉCNICO (CAPA EDGE):
                      - Modelo de Detección: MediaPipe EfficientDet-Lite2 / Neural Motor
                      - Tracking: Filtro de Kalman (8D) + Algoritmo Húngaro.
                      - Geometría: Espacio normalizado 1000x1000 píxeles.
                      
                      EVIDENCIA DISPONIBLE:
                      - Secuencia de capturas tácticas del vehículo (snapshots).
                      - Telemetría vectorial en tiempo real.
                      
                      DATOS TELEMÉTRICOS CERTIFICADOS:
                      - VEHÍCULO: ${kinematicData.label} (ID: ${track.id})
                      - VELOCIDAD: ${kinematicData.velocityKmH}
                      - ACELERACIÓN: ${kinematicData.acceleration} pts/f
                      - DWELL_TIME (ZONA): ${kinematicData.dwellTime}
                      - COMPORTAMIENTO ANÓMALO: ${kinematicData.isAnomalous}
                      
                      CONFIGURACIÓN GEOMÉTRICA ACTIVADA:
                      - SENSORES AFECTADOS: "${line.label}" (Tipo: ${line.type})
                      - PROTOCOLO VIGENTE: "${directives}"
                      - PRESET DE AUDITORÍA: "${presetInfo.label}" (${presetInfo.instructions})
                      
                      MISIÓN DE PERITAJE JUDICIAL:
                      Como Perito Supremo, debes seguir estrictamente este flujo forense:
                      
                      1. ANÁLISIS VISUAL: Identifica Marca, Modelo, Color y extrae Matrícula (OCR).
                      2. DETECCIÓN DE MANIOBRA: Clasifica el movimiento (Giro, Detención, Invasión de Carril, etc.).
                      3. CLASIFICACIÓN TÉCNICA (SISTEMA SENTINEL):
                         - TIPO_A: Infracción Geométrica Directa (Línea Continua, Sentido Contrario).
                         - TIPO_B: Infracción de Zona (Box Junction, Carga y Descarga, Stop).
                         - TIPO_C: Conducta Peligrosa (Aceleración/Frenada brusca, Zigzag).
                         - TIPO_D: Incumplimiento Normativo (Carril BUS, Prioridad Peatonal).
                      4. ANÁLISIS PREDICTIVO Y DE COMPORTAMIENTO:
                         - Riesgo Inmediato: Probabilidad de colisión en el momento.
                         - Distracción: Si el vehículo muestra trayectoria errática o el conductor usa móvil.
                      5. EVALUACIÓN LEGAL: Cita artículos específicos del RGC (Reglamento General de Circulación).
                      
                      RETORNA ÚNICAMENTE JSON EN ESTE FORMATO:
                      {
                        "infraction": boolean,
                        "plate": "TEXTO_MATRICULA o DESCONOCIDO",
                        "makeModel": "MARCA MODELO",
                        "color": "COLOR",
                        "description": "Relato técnico forense detallado de los hechos",
                        "severity": "LOW|MEDIUM|HIGH|CRITICAL",
                        "ruleCategory": "TIPO_A|TIPO_B|TIPO_C|TIPO_D",
                        "legalBase": "Artículos específicos del RGC (Art 154, Art 151, etc.)",
                        "reasoning": ["Evidencia 1", "Evidencia 2", "Evidencia 3"],
                        "visualTimestamp": "Extracción de reloj visible o HH:MM:SS de la escena",
                        "telemetry": { 
                           "speedEstimated": "${kinematicData.velocityKmH}",
                           "behaviorAnomalies": "Descripción de conducta"
                        }
                      }
                      
                      Idioma: ESPAÑOL TÉCNICO FORENSE GARANTISTA.`;

        try {
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        ...evidenceParts,
                        { text: promptText }
                    ]
                }]
            });
            const response = result.response;
            const responseText = response.text();

            let cleanJson = responseText.trim();
            if (cleanJson.includes("```json")) {
                cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
            } else if (cleanJson.includes("```")) {
                cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
            }

            const rawData = JSON.parse(cleanJson);
            return {
                ...rawData,
                plate: sanitizeText(rawData.plate || 'DESCONOCIDO'),
                description: sanitizeText(rawData.description || 'Sin descripción'),
                ruleCategory: sanitizeText(rawData.ruleCategory || 'VIOLACIÓN_VIAL'),
                reasoning: (rawData.reasoning || []).map((r: string) => sanitizeText(r)),
                visualTimestamp: sanitizeText(rawData.visualTimestamp || '--:--:--')
            };
        } catch (e) {
            logger.error("AI_SERVICE", "Error en auditoría forense", e);
            return { infraction: false, description: "Error en análisis forense" };
        }
    }
};
