import { GoogleGenAI, Type } from "@google/genai";
import { GeometryLine, InfractionLog, Track, SeverityType } from "../types";
import { logger } from "./logger";

/**
 * Servicio encargado de la comunicación con los modelos de IA de Google Gemini.
 * Implementa validación de seguridad y sanitización de contenido.
 */
const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY;
    if (!apiKey) {
        logger.error('AI_SERVICE', 'Falta la API Key de Gemini');
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
    async generateGeometry(directives: string, instruction?: string): Promise<GeometryResponse> {
        const ai = getAIClient();
        const prompt = `DIRECTIVAS DE INFRACCIÓN: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Generación automática de geometría'}". 
      
      Eres el motor geométrico de Sentinel AI. Tu misión CRÍTICA es crear una geometría de detección precisa basada en las directivas de infracción proporcionadas.
      
      ANÁLISIS DE ESCENA Y GENERACIÓN AUTOMÁTICA:
      1. Lee las DIRECTIVAS DE INFRACCIÓN. Identifica qué comportamientos se deben castigar (ej: giro prohibido, cruce de línea, exceso velocidad en zona).
      2. Crea AUTOMÁTICAMENTE líneas geométricas (horizontales, verticales u oblicuas) que intercepten a los vehículos que cometan dichas infracciones.
         - Si se prohíbe el giro a la izquierda: Coloca una línea OBLICUA/VERTICAL en la trayectoria de ese giro.
         - Si hay que respetar una línea de detención: Coloca una línea HORIZONTAL donde debe detenerse.
         - Si se prohíbe el cambio de carril: Coloca líneas LONGITUDINALES (verticales/oblicuas) entre carriles.
      
      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1. Máximo 4 decimales.
      - "label": Nombre corto y técnico de la zona (ej: "ZONA_GIRO_PROHIBIDO", "LINEA_STOP_1").
      - "type": Usa 'forbidden' para áreas donde entrar es infracción directa, 'stop_line' para líneas de detención, 'lane_divider' para separación.
      
      LIMITACIONES TÉCNICAS:
      - Genera un máximo de 12 líneas esenciales para cubrir todas las directivas.
      
      RETORNA ÚNICAMENTE EL JSON.
      {
        "lines": [...],
        "suggestedDirectives": "Resumen conciso y técnico de las reglas generadas (en Español)."
      }`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
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

        // Kinematic summary for the AI
        const kinematicData = {
            velocity: track.velocity.toFixed(4),
            heading: (track.heading * 180 / Math.PI).toFixed(2) + "°",
            trajectoryPoints: track.tail.length,
            label: track.label
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: track.snapshots[track.snapshots.length - 1] } },
                    {
                        text: `SISTEMA SENTINEL - AUDITORÍA DE CONDUCTA VIAL
                      
                      CONTEXTO ESPACIAL: El vehículo (Clase: ${kinematicData.label}) ha interactuado con la zona "${line.label}" (Tipo: ${line.type}).
                      TELEMETRÍA CINEMÁTICA: Velocidad relativa ${kinematicData.velocity}, Dirección ${kinematicData.heading}.
                      PROTOCOLOS VIGENTES: ${directives}.
                      
                      TAREA FRENSE:
                      1. Examina la imagen y la trayectoria para detectar conductas infractoras.
                      2. VALIDA ESTRICTAMENTE si la conducta viola los "PROTOCOLOS VIGENTES" listados arriba.
                      3. SI DETECTAS INFRACCIÓN: Cita explícitamente qué protocolo fue vulnerado en el campo "reasoning".
                      4. Dictamina (infraction: true/false) basado en la conexión entre geometría, cinemática y protocolos.
                      3. Genera un reporte JSON técnico.
                      IMPORTANTE: Todo el texto (descripción, razonamiento, categoría) DEBE estar en ESPAÑOL.` }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        infraction: { type: Type.BOOLEAN },
                        plate: { type: Type.STRING },
                        description: { type: Type.STRING },
                        severity: { type: Type.STRING },
                        legalArticle: { type: Type.STRING },
                        ruleCategory: { type: Type.STRING },
                        reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
                        telemetry: { type: Type.OBJECT, properties: { speedEstimated: { type: Type.STRING } } }
                    }
                }
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
