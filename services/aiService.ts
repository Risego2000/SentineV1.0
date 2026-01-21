import { GoogleGenAI, Type } from "@google/genai";
import { GeometryLine, InfractionLog, Track, SeverityType } from "../types";

const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY;
    if (!apiKey) throw new Error("API Key missing");
    return new GoogleGenAI(apiKey);
};

export interface GeometryResponse {
    lines: GeometryLine[];
    suggestedDirectives: string;
}

export const AIService = {
    async generateGeometry(directives: string, instruction?: string): Promise<GeometryResponse> {
        console.log("SENTINEL_AI: Iniciando generación de geometría...");
        const ai = getAIClient() as any;
        const prompt = `INSTRUCCIÓN ACTUAL: "${directives}". PETICIÓN ADICIONAL: "${instruction || 'Analiza la escena'}". 
      Eres un experto en seguridad vial y análisis espacial. Escanea la escena y define un sistema de detección de infracciones completo:
      1. Genera JSON con líneas que representen límites críticos (pueden ser HORIZONTALES, VERTICALES u OBLICUAS según la perspectiva y la vía).
      2. Cada línea debe tener una etiqueta descriptiva y un tipo ('forbidden','lane_divider','stop_line').
         IMPORTANTE: Los valores numéricos DEBEN tener un máximo de 3 posiciones decimales (ej: 0.123).
         LIMITA el análisis a un máximo de 10 zonas críticas.
      3. Basado EXCLUSIVAMENTE en este sistema de líneas, genera un texto breve con las reglas del protocolo de seguridad.
      
      CONEXIÓN: El sistema de tracking usará estas líneas para detectar infracciones mediante la intersección de vectores de trayectoria.
      
      RETORNA UN ÚNICO OBJETO JSON con este formato:
      {
        "lines": [...],
        "suggestedDirectives": "- Texto de regla 1\\n- Texto de regla 2..."
      }`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                }
            });

            const responseText = response.text.trim();
            console.log("SENTINEL_AI: Respuesta Recibida.");
            let cleanJson = responseText;

            if (responseText.includes("```json")) {
                cleanJson = responseText.split("```json")[1].split("```")[0].trim();
            } else if (responseText.includes("```")) {
                cleanJson = responseText.split("```")[1].split("```")[0].trim();
            }

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

            const data = JSON.parse(cleanJson);
            return {
                lines: (data.lines || []).slice(0, 10) as GeometryLine[],
                suggestedDirectives: data.suggestedDirectives || ""
            };
        } catch (e: any) {
            console.error("SENTINEL_AI_ERROR:", e);
            throw e;
        }
    },

    async runAudit(track: Track, line: GeometryLine, directives: string) {
        console.log(`SENTINEL_OPERATIVO: Iniciando Auditoría Forense Conectada para Track ${track.id}...`);
        const ai = getAIClient() as any;

        // El prompt ahora conecta: Identidad (Label/Color), Geometría (X/Y/Label), Cinética (Velocidad/Rumbo) y Protocolo
        const prompt = `AUDITORÍA FORENSE SENTINEL - SISTEMA CONECTADO
        
        [ENTIDAD DETECTADA]
        - Clase: ${track.label.toUpperCase()}
        - ID Interno: ${track.id}
        - Color de Seguimiento: ${track.color}
        
        [TELEMETRÍA CINÉTICA]
        - Velocidad Estimada (V-Vector): ${track.velocity.toFixed(4)}
        - Rumbo (Heading): ${track.heading.toFixed(4)} rad
        
        [ANÁLISIS ESPACIAL]
        - Zona de Intervención: "${line.label.toUpperCase()}"
        - Tipo de Línea: ${line.type} (Posición: ${line.x1},${line.y1} a ${line.x2},${line.y2})
        
        [PROTOCOLO VIGENTE]
        ${directives}
        
        EXAMEN: Analiza el fotograma adjunto y la trayectoria descrita por los datos cinéticos. 
        Dictamina si existe una infracción basada en la conexión entre la posición de la línea y el comportamiento del vehículo.
        
        RETORNA UN ÚNICO OBJETO JSON con este formato:
        {
          "infraction": boolean,
          "plate": "PATENTE/MATRÍCULA",
          "description": "Explicación detallada del comportamiento detectado",
          "severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
          "legalArticle": "Art. X del código de tráfico",
          "ruleCategory": "Categoría de infracción",
          "reasoning": ["Causa 1", "Causa 2"],
          "telemetry": { "speedEstimated": "X km/h" }
        }`;

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: track.snapshots[0] } },
                        { text: prompt }
                    ]
                }],
                config: { responseMimeType: "application/json" }
            });

            // Resiliencia de respuesta: el SDK puede devolver .text como propiedad o como función
            const responseText = (typeof result.text === 'function' ? await result.text() : result.text) || result.response?.text?.() || "";

            console.log(`SENTINEL_OPERATIVO: Análisis Track ${track.id} completado. Dictaminando...`);
            return JSON.parse(responseText.trim());
        } catch (e: any) {
            console.error(`SENTINEL_FORENSIC_FAILURE (Track ${track.id}):`, e);
            throw e;
        }
    }
};
