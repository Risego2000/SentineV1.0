import { GoogleGenAI, Type } from "@google/genai";
import { GeometryLine, InfractionLog, Track, SeverityType } from "../types";
import { logger } from "./logger";

/**
 * Servicio encargado de la comunicación con los modelos de IA de Google Gemini.
 * Implementa validación de seguridad y sanitización de contenido.
 */
const getAIClient = () => {
    // Vite uses import.meta.env
    const apiKey = (import.meta as any).env.VITE_GOOGLE_GENAI_KEY;

    if (!apiKey) {
        logger.error('AI_SERVICE', 'Falta la API Key de Gemini (VITE_GOOGLE_GENAI_KEY)');
        throw new Error("API Key missing");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Sanitiza texto para prevenir inyección de scripts básicos (XSS).
 */
export const sanitizeText = (text: string): string => {
    return text
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
    async generateGeometry(directives: string, instruction?: string, image?: string): Promise<GeometryResponse> {
        const ai = getAIClient();

        const prompt = `DIRECTIVAS DE INFRACCIÓN: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Generación automática de geometría'}". 
      
      Eres el motor geométrico de Sentinel AI. Tu misión CRÍTICA es crear una geometría de detección precisa basada en las directivas de infracción proporcionadas y la IMAGEN DE LA ESCENA adjunta.
      
      ANÁLISIS VISUAL OBLIGATORIO:
      1. Observa la imagen proporcionada del vial (si está presente).
      2. Identifica los carriles, líneas divisorias, y señales de tráfico (STOP, pasos de cebra).
      3. Coloca los vectores geométricos (x1, y1, x2, y2) EXACTAMENTE sobre las marcas viales visibles en el video.
      4. Si las directivas piden "Cruce Línea Continua", traza líneas 'lane_divider' sobre las líneas reales de la carretera.
      5. Si piden "STOP", coloca la 'stop_line' sobre la línea de detención real.
      
      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1 respecto a la imagen.
      - "label": Nombre corto y técnico de la zona.
      - "type": 'forbidden', 'stop_line', 'lane_divider' o 'box_junction'.
      
      IMPORTANTE: No te limites a coordenadas genéricas. Adapta la geometría a la PERSPECTIVA de la cámara en el video.
      
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

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts },
            config: {
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
                                    x1: { type: Type.NUMBER }, y1: { type: Type.NUMBER },
                                    x2: { type: Type.NUMBER }, y2: { type: Type.NUMBER },
                                    label: { type: Type.STRING },
                                    type: { type: Type.STRING }
                                }
                            }
                        },
                        suggestedDirectives: { type: Type.STRING }
                    }
                }
            }
        });
        const responseText = response.text.trim();
        let cleanJson = responseText;

        // Remove markdown backticks if present
        if (responseText.includes("```json")) {
            cleanJson = responseText.split("```json")[1].split("```")[0].trim();
        } else if (responseText.includes("```")) {
            cleanJson = responseText.split("```")[1].split("```")[0].trim();
        }

        // AGGRESSIVE CLEANUP: Fix cases where AI returns floats with hundreds of decimals
        cleanJson = cleanJson.replace(/(\d+\.\d{6})\d+/g, "$1");

        // TRUNCATED JSON FALLBACK: If the JSON is cut off, try to close it
        let openBraces = (cleanJson.match(/\{/g) || []).length;
        let closeBraces = (cleanJson.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            // Very basic repair: if we have an unclosed array or object, close it
            if (cleanJson.includes('"lines": [') && !cleanJson.includes(']')) {
                cleanJson += ']}';
            } else if (openBraces > closeBraces) {
                cleanJson += '}'.repeat(openBraces - closeBraces);
            }
        }

        try {
            const data = JSON.parse(cleanJson);

            // VALIDACIÓN: Asegurar que las coordenadas son seguras
            const validatedLines = (data.lines || [])
                .filter((l: any) =>
                    typeof l.x1 === 'number' && !isNaN(l.x1) &&
                    typeof l.y1 === 'number' && !isNaN(l.y1)
                )
                .slice(0, 10) as GeometryLine[];

            return {
                lines: validatedLines,
                suggestedDirectives: sanitizeText(data.suggestedDirectives || "")
            };
        } catch (e) {
            logger.error("AI_SERVICE", "Error al parsear JSON de geometría", { json: cleanJson });
            throw new Error("Respuesta de IA con formato incorrecto");
        }
    },

    /**
     * Realiza una auditoría visual y cinemática de una maniobra.
     * @param track Información de trayectoria y capturas del vehículo.
     * @param line Línea o zona con la que interactuó.
     * @param directives Protocolos de seguridad vigentes.
     */
    async runAudit(track: Track, line: GeometryLine, directives: string) {
        const ai = getAIClient();

        // Resumen cinemático para la IA
        const kinematicData = {
            avgVelocity: (track.avgVelocity * 100).toFixed(2), // Escala visual 0-100
            currentSpeed: (track.velocity * 100).toFixed(2),
            acceleration: (track.acceleration * 100).toFixed(4),
            heading: (track.heading * 180 / Math.PI).toFixed(2) + "°",
            trajectoryPoints: track.tail.length,
            label: track.label
        };

        // Preparar evidencias (Contexto + Zoom)
        const evidenceParts = track.snapshots.map((data, index) => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data
            }
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [
                    ...evidenceParts,
                    {
                        text: `SENTINEL AI - UNIDAD DE AUDITORÍA FORENSE OMNI-V1.6
                      
                      EVIDENCIA DISPONIBLE:
                      - Imag 1: Contexto Escena Completa.
                      - Imag 2: Zoom Táctico de Alta Resolución (para identificación de placa/detalles).
                      
                      DATOS TELEMÉTRICOS (UNIDAD VECTORIAL):
                      - VEHÍCULO: ${kinematicData.label} (ID: ${track.id})
                      - VELOCIDAD MEDIA: ${kinematicData.avgVelocity} pts
                      - ACELERACIÓN ACTUAL: ${kinematicData.acceleration} pts/f
                      - VECTOR DE RUMBO: ${kinematicData.heading}
                      
                      CONFIGURACIÓN GEOMÉTRICA:
                      - ZONA ACTIVADA: "${line.label}" (Tipo: ${line.type})
                      - PROTOCOLO VIGENTE:
                      ${directives}
                      
                      MISIÓN DE PERITAJE JUDICIAL:
                      Actúa como un Perito de Tráfico Avanzado. Analiza la secuencia de imágenes (Contexto + Zoom) y la telemetría para generar un Expediente Forense vinculante.
                      
                      PROCEDIMIENTO OBLIGATORIO:
                      1. IDENTIFICACIÓN TÉCNICA: Indica Marca, Modelo y Color dominante del vehículo.
                      2. OCR MATRICULAR: Lee la placa (plate) con precisión quirúrgica en el Zoom Táctico.
                      3. ANÁLISIS CONDUCTUAL: Valida si la maniobra (intersección, giro, dwellTime) viola el protocolo.
                      4. BASE LEGAL (RGC): Cita los artículos del Reglamento General de Circulación infringidos.
                      
                      RETORNA ÚNICAMENTE JSON EN ESTE FORMATO:
                      {
                        "infraction": boolean,
                        "plate": "TEXTO_MATRICULA o DESCONOCIDO",
                        "makeModel": "MARCA MODELO",
                        "color": "COLOR VEHÍCULO",
                        "description": "Relato técnico detallado de la maniobra",
                        "severity": "LOW|MEDIUM|HIGH|CRITICAL",
                        "ruleCategory": "Categoría DGT",
                        "legalBase": "Artículos del RGC vinculados (ej: Art 154, Art 151.2)",
                        "reasoning": ["Hecho 1: Posición respecto a línea", "Hecho 2: Telemetría vs Protocolo"],
                        "telemetry": { 
                           "speedEstimated": "Velocidad aprox en reporte",
                           "acceleration": "Tendencia de aceleración"
                        }
                      }
                      
                      Idioma: ESPAÑOL TÉCNICO FORENSE.` }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        try {
            const rawData = JSON.parse(response.text.trim());

            // SANITIZACIÓN: Limpiar campos de texto antes de entregarlos al UI
            return {
                ...rawData,
                plate: sanitizeText(rawData.plate || 'DESCONOCIDO'),
                description: sanitizeText(rawData.description || 'Sin descripción'),
                ruleCategory: sanitizeText(rawData.ruleCategory || 'VIOLACIÓN_VIAL'),
                reasoning: (rawData.reasoning || []).map((r: string) => sanitizeText(r))
            };
        } catch (e) {
            logger.error("AI_SERVICE", "Error en auditoría forense", { result: response.text });
            return { infraction: false, description: "Error en análisis forense" };
        }
    }
};
