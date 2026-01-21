import { GoogleGenAI, Type } from "@google/genai";
import { GeometryLine, InfractionLog, Track, SeverityType } from "../types";

const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY;
    if (!apiKey) throw new Error("API Key missing");
    return new GoogleGenAI({ apiKey });
};

export interface GeometryResponse {
    lines: GeometryLine[];
    suggestedDirectives: string;
}

export const AIService = {
    async generateGeometry(directives: string, instruction?: string): Promise<GeometryResponse> {
        const ai = getAIClient();
        const prompt = `INSTRUCCIÓN ACTUAL: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Analiza la escena'}". 
      Eres un experto en seguridad vial. Analiza la geometría de la vía y:
      1. Genera JSON con líneas (x1,y1,x2,y2 0-1), etiqueta y tipo ('forbidden','lane_divider','stop_line').
      2. Basado EXCLUSIVAMENTE en la geometría que has creado, genera un texto breve (máximo 3 puntos) con las reglas de protocolo de seguridad (directivas) que Sentinel debe auditar.
      
      RETORNA UN ÚNICO OBJETO JSON con este formato:
      {
        "lines": [...],
        "suggestedDirectives": "- Texto de regla 1\\n- Texto de regla 2..."
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

        try {
            const data = JSON.parse(cleanJson);
            return {
                lines: (data.lines || []) as GeometryLine[],
                suggestedDirectives: data.suggestedDirectives || ""
            };
        } catch (e) {
            console.error("Malformed AI JSON:", cleanJson);
            // Si falla el parseo, intentamos limpiar caracteres de control comunes
            try {
                const fixedJson = cleanJson.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                const data = JSON.parse(fixedJson);
                return {
                    lines: (data.lines || []) as GeometryLine[],
                    suggestedDirectives: data.suggestedDirectives || ""
                };
            } catch (innerE) {
                throw new Error("Respuesta de IA con formato incorrecto");
            }
        }
    },

    async runAudit(track: Track, line: GeometryLine, directives: string) {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: track.snapshots[0] } },
                    { text: `AUDITORÍA SENTINEL: Vehículo cruzó "${line.label}". Reglas: ${directives}. Evalúa infracción y genera reporte JSON.` }
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
        return JSON.parse(response.text.trim());
    }
};
