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
      1. Lee las DIRECTIVAS DE INFRACCIÓN. Identifica qué comportamientos se deben castigar.
      2. Crea AUTOMÁTICAMENTE líneas geométricas (horizontales, verticales u oblicuas) para interceptar infracciones VISUALES:
      
         A. CRUCE DE LÍNEAS / GIROS:
            - "Cruce Línea Continua": Genera 'lane_divider' estrictos a lo largo de las divisiones de carril visibles.
            - "Giro Prohibido": Genera barreras 'forbidden' oblicuas/curvas que bloqueen la trayectoria del giro ilegal.
            - "Sentido Contrario": Genera líneas 'lane_divider' oblicuas que crucen el carril para detectar vectores opuestos.

         B. INTERSECCIONES Y PRIORIDAD:
            - "Saltarse STOP" / "Semáforo Rojo": Genera una 'stop_line' HORIZONTAL precisa justo antes de la intersección.
            - "Saltarse Ceda el Paso": Genera una línea de 'stop_line' (o 'yield_line') en el punto de incorporación.
            - "Bloqueo Intersección (Yellow Box)": Genera un polígono (o varias líneas 'forbidden') cruzando el centro de la intersección (caja amarilla).

         C. ZONAS PROTEGIDAS:
            - "Invasión Paso Peatones": Genera líneas 'forbidden' rodeando o cruzando el paso de cebra.
            - "Estacionamiento Doble Fila": Genera líneas 'forbidden' longitudinales paralelas al bordillo (donde aparcarían ilegalmente).
            - "Invasión Arcén": Genera líneas 'forbidden' delimitando el arcén.
      
      REGLAS DE GENERACIÓN DE JSON:
      - Genera un JSON con un array "lines".
      - Coordenadas (x1, y1, x2, y2) normalizadas entre 0 y 1. Máximo 4 decimales.
      - "label": Nombre corto y técnico de la zona (ej: "ZONA_GIRO_PROHIBIDO", "LINEA_STOP_1").
      - "type": Usa 'forbidden' para áreas donde entrar es infracción directa, 'stop_line' para líneas de detención, 'lane_divider' para separación.
      
      LIMITACIONES TÉCNICAS:
      - Genera un máximo de 15 líneas esenciales para cubrir todas las directivas.
      
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
                        text: `SISTEMA SENTINEL - AUDITORÍA FORENSE AVANZADA V1.5
                      
                      CONTEXTO OPERATIVO:
                      - ZONA ACTIVADA: "${line.label}" (Tipo: ${line.type})
                      - VEHÍCULO OBJETIVO: ${kinematicData.label} (Track ID: ${track.id})
                      - DATOS CINEMÁTICOS: Velocidad ${kinematicData.velocity}, Orientación ${kinematicData.heading}, Puntos Trazados: ${kinematicData.trajectoryPoints}.
                      - PROTOCOLOS DE SEGURIDAD ACTIVOS:
                      ${directives}
                      
                      MISIÓN DE ANÁLISIS FORENSE:
                      Actúa como un Perito de Tráfico experto. Tu tarea es validar si la interacción del vehículo con la zona constituye una INFRACCIÓN CONFIRMADA basándote en la evidencia visual y telemétrica.

                      PROCEDIMIENTO DE VALIDACIÓN (Paso a Paso):

                      1. ANÁLISIS VISUAL DE ENTORNO:
                         - Observa la posición relativa del vehículo respecto a las marcas viales (líneas continuas, pasos de cebra, líneas de stop).
                         - ¿El vehículo está ocupando físicamente una zona prohibida (isleta, arcén, acera)?

                      2. ANÁLISIS VECTORIAL (Cinemática):
                         - Si es un STOP/SEMÁFORO: ¿La velocidad es cercana a 0 en la línea de detención? (Si cruza con velocidad alta > Infracción).
                         - Si es SENTIDO CONTRARIO: ¿El ángulo de movimiento (${kinematicData.heading}) es opuesto al flujo natural de la vía (+- 160-180 grados)?
                         - Si es GIRO PROHIBIDO: ¿La curva de trayectoria cruza la barrera geométrica hacia la dirección restringida?

                      3. CORRELACIÓN CON PROTOCOLOS:
                         - Compara la maniobra observada con la lista de "PROTOCOLOS ACTIVOS".
                         - EJEMPLO: Si el protocolo dice "Prohibido Giro Izquierda" y el vehículo gira a la izquierda -> INFRACCIÓN VERDADERA.
                         - EJEMPLO: Si el protocolo dice "Estacionamiento Doble Fila" y el vehículo tiene velocidad 0 en carril -> INFRACCIÓN VERDADERA.

                      CRITERIOS DE SENTENCIA:
                      - Solo marca "infraction: true" si la evidencia es contundente.
                      - Si es una maniobra dubitativa o leve corrección dentro del carril, marca "false".
                      
                      GENERACIÓN DE REPORTE:
                      - "description": Describe la maniobra técnica (ej: "Vehículo cruza línea continua invadiendo carril contrario").
                      - "reasoning": Explica POR QUÉ viola el protocolo específico (ej: "La trayectoria balística confirma giro prohibido a la izquierda en intersección señalizada").
                      - "ruleCategory": Usa categorías estándar DGT (ej: "SEGURIDAD_VIAL", "PRIORIDAD_PASO").
                      
                      Idioma de salida: ESPAÑOL TÉCNICO.` }
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
