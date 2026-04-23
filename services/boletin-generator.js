import { jsPDF } from 'jspdf';
import { sanitizeText } from './aiServer.js';

/**
 * Generate a formal infraction report (boletín de denuncia)
 * based on detected infractions
 */
export const generateBoletin = ({
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
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BOLETÍN DE DENUNCIA', pageWidth / 2, margin + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sistema de Fiscalización Automática - Sentinel AI v16', pageWidth / 2, margin + 17, { align: 'center' });

    // Border
    doc.setDrawColor(0, 51, 102);
    doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

    // Content area
    let yPos = margin + 25;
    const contentWidth = pageWidth - margin * 2;

    // Timestamp
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('FECHA Y HORA DE LA INFRACCIÓN:', margin + 5, yPos);
    doc.setFont('helvetica', 'normal');
    const date = timestamp ? new Date(timestamp).toLocaleString('es-ES') : 'Desconocida';
    doc.text(date, margin + 70, yPos);
    yPos += 10;

    // Plate
    doc.setFont('helvetica', 'bold');
    doc.text('MATRÍCULA DEL VEHÍCULO:', margin + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text(sanitizeText(plate || 'NO DETECTADA'), margin + 70, yPos - 1);
    yPos += 10;

    // Vehicle info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL VEHÍCULO:', margin + 5, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Marca/Modelo: ${sanitizeText(makeModel || 'No identificado')}`, margin + 10, yPos);
    yPos += 5;
    doc.text(`Color: ${sanitizeText(color || 'No identificado')}`, margin + 10, yPos);
    yPos += 10;

    // Infraction details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INFRACCIÓN COMETIDA:', margin + 5, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tipo: ${sanitizeText(infractionType || 'Infracción de tráfico')}`, margin + 10, yPos);
    yPos += 5;

    const severityText = severity === 'CRITICAL' ? 'CRÍTICA'
      : severity === 'HIGH' ? 'ALTA'
        : severity === 'MEDIUM' ? 'MEDIA'
          : 'BAJA';
    doc.text(`Gravedad: ${severityText}`, margin + 10, yPos);
    yPos += 10;

    // Description (wrapped text)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DESCRIPCIÓN:', margin + 5, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const descriptionText = sanitizeText(description || 'Infracción detectada por sistema de visión automática');
    const lines = doc.splitTextToSize(descriptionText, contentWidth - 10);
    doc.text(lines, margin + 10, yPos);
    yPos += lines.length * 5 + 5;

    // Location
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('UBICACIÓN:', margin + 5, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(sanitizeText(location || 'Ubicación no disponible'), margin + 10, yPos);
    yPos += 10;

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      'Este boletín ha sido generado automáticamente por el Sistema Sentinel AI de fiscalización de tráfico.',
      pageWidth / 2,
      pageHeight - margin - 5,
      { align: 'center' }
    );
    doc.text(
      `Generado: ${new Date().toLocaleString('es-ES')}`,
      pageWidth / 2,
      pageHeight - margin + 2,
      { align: 'center' }
    );

    return doc.output('arraybuffer');
  } catch (error) {
    console.error('[BOLETIN] Error generating report:', error);
    throw error;
  }
};
