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
                      Actúa como un Perito de Tráfico Avanzado. Analiza la secuencia de imágenes y la telemetría para dictaminar si existe una infracción confirmada.
                      
                      PROCEDIMIENTO OBLIGATORIO:
                      1. IDENTIFICACIÓN: Intenta leer la matrícula (plate) en el Zoom de Alta Resolución.
                      2. ANÁLISIS CINÉTICO: ¿La velocidad y aceleración coinciden con una conducta infractora (ej: no detenerse en STOP)?
                      3. VALIDACIÓN DE PROTOCOLO: Confronta la maniobra visualizada con las directivas de seguridad.
                      
                      RETORNA ÚNICAMENTE JSON EN ESTE FORMATO:
                      {
                        "infraction": boolean,
                        "plate": "TEXTO_MATRICULA o DESCONOCIDO",
                        "description": "Descripción técnica de la maniobra",
                        "severity": "LOW|MEDIUM|HIGH|CRITICAL",
                        "ruleCategory": "Categoría DGT",
                        "reasoning": ["Punto clave 1", "Punto clave 2"],
                        "telemetry": { "speedEstimated": "Velocidad aprox en reporte" }
                      }
                      
                      Idioma: ESPAÑOL TÉCNICO.` }
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
