import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { sanitizeText } from './aiServer.js';

/**
 * Generate a formal infraction report (boletín de denuncia)
 * Using the template PDF: boletin_v4.pdf
 * Fills in infraction details on the template
 */
export const generateBoletin = async ({
  plate,
  infractionType,
  timestamp,
  location,
  description,
  severity,
  makeModel,
  color,
}) => {
  try {
    // Load the template PDF
    const templatePath = path.join(process.cwd(), 'public', 'boletin_v4.pdf');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template PDF not found at ${templatePath}`);
    }

    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Prepare data
    const dateStr = timestamp ? new Date(timestamp).toLocaleString('es-ES') : 'Desconocida';
    const plateText = sanitizeText(plate || 'NO DETECTADA');
    const typeText = sanitizeText(infractionType || 'Infracción de tráfico');
    const modelText = sanitizeText(makeModel || 'No identificado');
    const colorText = sanitizeText(color || 'No identificado');
    const descText = sanitizeText(description || 'Infracción detectada por sistema de visión automática');
    const locText = sanitizeText(location || 'Ubicación no disponible');

    const severityText = severity === 'CRITICAL' ? 'CRÍTICA'
      : severity === 'HIGH' ? 'ALTA'
        : severity === 'MEDIUM' ? 'MEDIA'
          : 'BAJA';

    // Draw fields on the template (adjust coordinates based on template layout)
    // These coordinates need to be adjusted based on the actual template structure

    // Fecha y Hora
    firstPage.drawText(dateStr, {
      x: 320,
      y: height - 150,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Matrícula
    firstPage.drawText(plateText, {
      x: 320,
      y: height - 180,
      size: 14,
      color: rgb(0, 0, 0),
    });

    // Marca/Modelo
    firstPage.drawText(modelText, {
      x: 100,
      y: height - 220,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Color
    firstPage.drawText(colorText, {
      x: 100,
      y: height - 240,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Tipo de Infracción
    firstPage.drawText(typeText, {
      x: 100,
      y: height - 280,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Gravedad
    firstPage.drawText(severityText, {
      x: 100,
      y: height - 300,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Descripción (with wrapping)
    const descLines = wrapText(descText, 80);
    let descY = height - 340;
    descLines.forEach(line => {
      firstPage.drawText(line, {
        x: 100,
        y: descY,
        size: 9,
        color: rgb(0, 0, 0),
      });
      descY -= 15;
    });

    // Ubicación
    firstPage.drawText(locText, {
      x: 100,
      y: descY - 20,
      size: 10,
      color: rgb(0, 0, 0),
    });

    // Timestamp de generación
    const generatedTime = new Date().toLocaleString('es-ES');
    firstPage.drawText(`Generado: ${generatedTime}`, {
      x: width / 2 - 80,
      y: 20,
      size: 8,
      color: rgb(100, 100, 100),
    });

    // Save and return as buffer
    const pdfBytesOutput = await pdfDoc.save();
    return pdfBytesOutput;

  } catch (error) {
    console.error('[BOLETIN] Error generating report:', error);
    throw error;
  }
};

/**
 * Helper function to wrap text
 */
function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}
