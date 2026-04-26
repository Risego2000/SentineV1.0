/**
 * PDF Export Service - TIER 1
 * Generates PDF reports from expedients using template
 */

import { Expedient } from '../domain/Expedient';
import { SignatureService } from './SignatureService';
import { logger } from './logger';
import { PDFDocument, rgb, PDFPage } from 'pdf-lib';

export interface PDFExportOptions {
  includeAuditTrail: boolean;
  includePhotos: boolean;
  watermark?: 'PREINFORME' | 'OFICIAL';
}

/**
 * PDF Export Service - uses pdf-lib to generate PDFs from template
 */
export class PDFExportService {
  /**
   * Generate PDF from expedient using template
   */
  static async generatePDF(
    expedient: Expedient,
    options: PDFExportOptions = {
      includeAuditTrail: true,
      includePhotos: false,
      watermark: 'OFICIAL',
    }
  ): Promise<Uint8Array | null> {
    try {
      const watermark = options.watermark || 'OFICIAL';

      // Only require signature for OFICIAL reports
      if (watermark === 'OFICIAL') {
        const verification = await SignatureService.verifyExpedientSignature(expedient);

        if (!verification.isValid) {
          logger.warn('PDF_EXPORT', 'No se puede exportar OFICIAL: firma inválida', {
            expedientId: expedient.id,
          });
          return null;
        }
      }

      // Load template PDF
      const templatePath = '/boletin_v4.pdf';
      const templateBytes = await fetch(templatePath).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Get first page
      const page = pdfDoc.getPage(0);
      const { height } = page.getSize();

      // Add expedient data to PDF
      this.fillPDFFields(page, expedient, watermark, height);

      // Add watermark
      this.addWatermark(page, watermark, height);

      // Save and return PDF bytes
      const pdfBytes = await pdfDoc.save();

      logger.info('PDF_EXPORT', `Generated PDF for ${expedient.id}`, {
        size: pdfBytes.length,
        watermark: options.watermark,
      });

      return pdfBytes;
    } catch (error) {
      logger.error('PDF_EXPORT', 'PDF generation failed', error);
      return null;
    }
  }

  /**
   * Fill PDF template fields with expedient data
   * Mapped to exact field locations in BOLETÍN DE DENUNCIA
   */
  private static fillPDFFields(
    page: PDFPage,
    expedient: Expedient,
    watermark: string,
    pageHeight: number
  ): void {
    const fontSize = 9;
    const smallFontSize = 8;
    const color = rgb(0, 0, 0);

    // Extract date/time
    const date = new Date(expedient.timestamp);
    const dateStr = date.toLocaleDateString('es-ES');
    const timeStr = date.toLocaleTimeString('es-ES').slice(0, 5);

    // Exact positions for BOLETÍN DE DENUNCIA form
    const fields = [
      // TOP HEADER SECTION
      // 1. EXPEDIENTE Nº
      {
        label: expedient.id.slice(0, 8),
        x: 370,
        y: pageHeight - 173,
        size: fontSize,
      },
      // 2. FECHA DENUNCIA
      {
        label: dateStr,
        x: 510,
        y: pageHeight - 173,
        size: fontSize,
      },
      // 3. HORA INFRACCIÓN
      {
        label: timeStr,
        x: 750,
        y: pageHeight - 173,
        size: fontSize,
      },

      // SECCIÓN 01: LUGAR Y CIRCUNSTANCIAS DE LA INFRACCIÓN
      // VÍA / CALLE / CARRETERA
      {
        label: expedient.via || expedient.location,
        x: 415,
        y: pageHeight - 290,
        size: fontSize,
      },
      // KM / Nº / PUNTO KILOMÉTRICO
      {
        label: expedient.numeroPuntoKilometrico || '',
        x: 900,
        y: pageHeight - 290,
        size: fontSize,
      },
      // MUNICIPIO
      {
        label: expedient.municipio || '',
        x: 415,
        y: pageHeight - 305,
        size: fontSize,
      },
      // PROVINCIA
      {
        label: expedient.provincia || '',
        x: 700,
        y: pageHeight - 305,
        size: fontSize,
      },
      // GRAVEDAD
      {
        label: expedient.gravedad || '',
        x: 900,
        y: pageHeight - 305,
        size: fontSize,
      },

      // SECCIÓN 03: IDENTIFICACIÓN DEL VEHÍCULO
      // MATRÍCULA
      {
        label: expedient.licensePlate,
        x: 420,
        y: pageHeight - 365,
        size: fontSize,
      },
      // MARCA
      {
        label: expedient.marca || '',
        x: 415,
        y: pageHeight - 380,
        size: fontSize,
      },
      // MODELO
      {
        label: expedient.modelo || '',
        x: 600,
        y: pageHeight - 380,
        size: fontSize,
      },
      // COLOR
      {
        label: expedient.color || '',
        x: 800,
        y: pageHeight - 380,
        size: fontSize,
      },
      // NÚMERO DE CHASIS (VIN)
      {
        label: expedient.numeroChasis || '',
        x: 415,
        y: pageHeight - 395,
        size: smallFontSize,
      },
      // ESTADO ITV
      {
        label: expedient.estadoITV || '',
        x: 700,
        y: pageHeight - 395,
        size: fontSize,
      },
      // SEGURO OBLIGATORIO
      {
        label: expedient.seguroObligatorio ? 'Sí' : 'No',
        x: 900,
        y: pageHeight - 395,
        size: fontSize,
      },

      // SECCIÓN 04: DATOS DEL TITULAR DEL VEHÍCULO
      // NOMBRE Y APELLIDOS
      {
        label: expedient.titularNombre || '',
        x: 415,
        y: pageHeight - 435,
        size: fontSize,
      },
      // DNI/NIE
      {
        label: expedient.titularDNI || '',
        x: 700,
        y: pageHeight - 435,
        size: fontSize,
      },
      // DOMICILIO
      {
        label: expedient.titularDomicilio || '',
        x: 415,
        y: pageHeight - 450,
        size: smallFontSize,
      },
      // LOCALIDAD
      {
        label: expedient.titularLocalidad || '',
        x: 700,
        y: pageHeight - 450,
        size: fontSize,
      },
      // PROVINCIA
      {
        label: expedient.titularProvincia || '',
        x: 850,
        y: pageHeight - 450,
        size: fontSize,
      },
      // TELÉFONO
      {
        label: expedient.titularTelefono || '',
        x: 415,
        y: pageHeight - 465,
        size: fontSize,
      },
      // EMAIL
      {
        label: expedient.titularEmail || '',
        x: 650,
        y: pageHeight - 465,
        size: fontSize,
      },

      // SECCIÓN 05: DATOS DEL CONDUCTOR (SI DIFERENTE)
      // NOMBRE Y APELLIDOS
      {
        label: expedient.conductorNombre || '',
        x: 415,
        y: pageHeight - 505,
        size: fontSize,
      },
      // DNI/NIE
      {
        label: expedient.conductorDNI || '',
        x: 700,
        y: pageHeight - 505,
        size: fontSize,
      },
      // PERMISO DE CONDUCIR
      {
        label: expedient.conductorPermiso || '',
        x: 415,
        y: pageHeight - 520,
        size: fontSize,
      },
      // CLASE
      {
        label: expedient.conductorClase || '',
        x: 700,
        y: pageHeight - 520,
        size: fontSize,
      },
      // DOMICILIO
      {
        label: expedient.conductorDomicilio || '',
        x: 415,
        y: pageHeight - 535,
        size: smallFontSize,
      },
      // LOCALIDAD
      {
        label: expedient.conductorLocalidad || '',
        x: 700,
        y: pageHeight - 535,
        size: fontSize,
      },
      // PROVINCIA
      {
        label: expedient.conductorProvincia || '',
        x: 850,
        y: pageHeight - 535,
        size: fontSize,
      },
      // TELÉFONO
      {
        label: expedient.conductorTelefono || '',
        x: 415,
        y: pageHeight - 550,
        size: fontSize,
      },
      // EMAIL
      {
        label: expedient.conductorEmail || '',
        x: 650,
        y: pageHeight - 550,
        size: fontSize,
      },

      // SECCIÓN 06: DESCRIPCIÓN DETALLADA DE LOS HECHOS
      // TIPO DE INFRACCIÓN
      {
        label: `Tipo: ${expedient.violationType}`,
        x: 415,
        y: pageHeight - 590,
        size: fontSize,
      },
      // DESCRIPCIÓN DETALLADA
      {
        label: expedient.descripcionDetalladaHechos || expedient.vehicleDescription || '',
        x: 415,
        y: pageHeight - 605,
        size: smallFontSize,
      },
      // CIRCUNSTANCIAS AGRAVANTES
      {
        label: expedient.circunstanciasAgravantes || '',
        x: 415,
        y: pageHeight - 620,
        size: smallFontSize,
      },

      // METADATOS
      // OPERADOR
      {
        label: `Operador: ${expedient.operator || 'N/A'}`,
        x: 415,
        y: pageHeight - 660,
        size: smallFontSize,
      },
      // SUPERVISOR/FIRMANTE
      {
        label: `Supervisora: ${expedient.supervisor || 'N/A'}`,
        x: 415,
        y: pageHeight - 675,
        size: smallFontSize,
      },
      // ESTADO
      {
        label: `Estado: ${expedient.state}`,
        x: 700,
        y: pageHeight - 660,
        size: smallFontSize,
      },
    ];

    // Draw all fields
    for (const field of fields) {
      // Skip empty labels
      if (!field.label || field.label.trim() === '') {
        continue;
      }

      page.drawText(field.label, {
        x: field.x,
        y: field.y,
        size: field.size,
        color,
      });
    }
  }

  /**
   * Add watermark to PDF
   */
  private static addWatermark(
    page: PDFPage,
    watermark: string,
    pageHeight: number
  ): void {
    const watermarkText = watermark === 'OFICIAL' ? 'OFICIAL' : 'PREINFORME';
    const opacity = watermark === 'OFICIAL' ? 0.1 : 0.2;

    // Add watermark text (light gray)
    page.drawText(watermarkText, {
      x: 100,
      y: pageHeight / 2 - 50,
      size: 48,
      color: rgb(0.78, 0.78, 0.78),
      opacity,
    });
  }

  /**
   * Download PDF to browser
   */
  static async downloadPDF(pdfBytes: Uint8Array, expedientId: string): Promise<void> {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Expediente_${expedientId.slice(0, 8)}_${new Date().getTime()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
