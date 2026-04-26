/**
 * Excel Export Service - TIER 1
 * Exports expedient data to XLSX with embedded images
 */

import ExcelJS from 'exceljs';
import { Expedient } from '../domain/Expedient';

export class ExcelExportService {
  /**
   * Generate Excel file with all expedient data and images
   */
  static async generateExcel(
    expedient: Expedient,
    photos?: { name: string; base64: string }[],
    videoThumbnail?: string
  ): Promise<Buffer | null> {
    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Información General
      this.addGeneralInfoSheet(workbook, expedient);

      // Sheet 2: Lugar de la Infracción
      this.addLocationSheet(workbook, expedient);

      // Sheet 3: Vehículo
      this.addVehicleSheet(workbook, expedient);

      // Sheet 4: Titular y Conductor
      this.addPersonalDataSheet(workbook, expedient);

      // Sheet 5: Hechos y Descripción
      this.addFactsSheet(workbook, expedient);

      // Sheet 6: Evidencia (Fotos)
      if (photos && photos.length > 0) {
        await this.addPhotosSheet(workbook, photos);
      }

      // Sheet 7: Auditoría y Historial
      this.addAuditSheet(workbook, expedient);

      // Sheet 8: Firma Digital
      this.addSignatureSheet(workbook, expedient);

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as Buffer;
    } catch (error) {
      console.error('[ExcelExportService] Error generating Excel:', error);
      return null;
    }
  }

  /**
   * Add General Information sheet
   */
  private static addGeneralInfoSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Información General');

    // Styling
    const headerStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2C3E50' } },
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    };

    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    // Title
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '📋 EXPEDIENTE DE INFRACCIÓN';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF2C3E50' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'center' };

    // ID y Timestamp
    let row = 3;
    this.addRow(sheet, 'ID Expediente', expedient.id, row, labelStyle);
    this.addRow(sheet, 'ID Infracción', expedient.infractionId, row + 1, labelStyle);
    this.addRow(sheet, 'Fecha Creación', new Date(expedient.createdAt).toLocaleString('es-ES'), row + 2, labelStyle);
    this.addRow(sheet, 'Última Actualización', new Date(expedient.updatedAt).toLocaleString('es-ES'), row + 3, labelStyle);
    this.addRow(sheet, 'Estado', expedient.state, row + 4, labelStyle);

    // Infracción
    row += 6;
    this.addRow(sheet, 'Tipo de Infracción', expedient.violationType, row, labelStyle);
    this.addRow(sheet, 'Ubicación', expedient.location, row + 1, labelStyle);
    this.addRow(sheet, 'Fecha/Hora Infracción', new Date(expedient.timestamp).toLocaleString('es-ES'), row + 2, labelStyle);
    this.addRow(sheet, 'Matrícula Vehículo', expedient.licensePlate, row + 3, labelStyle);

    // Operador y Supervisor
    row += 5;
    this.addRow(sheet, 'Operador', expedient.operator || '—', row, labelStyle);
    this.addRow(sheet, 'Supervisor', expedient.supervisor || '—', row + 1, labelStyle);

    sheet.columns = [
      { width: 25 },
      { width: 35 },
      { width: 20 },
      { width: 20 },
    ];
  }

  /**
   * Add Location sheet
   */
  private static addLocationSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Lugar de Infracción');
    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    let row = 1;
    sheet.getCell(`A${row}`).value = '📍 DATOS DEL LUGAR';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;
    this.addRow(sheet, 'Vía/Calle', expedient.via || '—', row, labelStyle);
    this.addRow(sheet, 'KM/Punto Kilométrico', expedient.numeroPuntoKilometrico || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Municipio', expedient.municipio || '—', row + 2, labelStyle);
    this.addRow(sheet, 'Provincia', expedient.provincia || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Latitud', expedient.latitud?.toString() || '—', row + 4, labelStyle);
    this.addRow(sheet, 'Longitud', expedient.longitud?.toString() || '—', row + 5, labelStyle);
    this.addRow(sheet, 'Gravedad', expedient.gravedad || '—', row + 6, labelStyle);

    sheet.columns = [{ width: 25 }, { width: 35 }, { width: 20 }, { width: 20 }];
  }

  /**
   * Add Vehicle sheet
   */
  private static addVehicleSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Vehículo');
    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    let row = 1;
    sheet.getCell(`A${row}`).value = '🚗 DATOS DEL VEHÍCULO';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;
    this.addRow(sheet, 'Matrícula', expedient.licensePlate, row, labelStyle);
    this.addRow(sheet, 'Marca', expedient.marca || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Modelo', expedient.modelo || '—', row + 2, labelStyle);
    this.addRow(sheet, 'Color', expedient.color || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Número de Chasis', expedient.numeroChasis || '—', row + 4, labelStyle);
    this.addRow(sheet, 'Estado ITV', expedient.estadoITV || '—', row + 5, labelStyle);
    this.addRow(sheet, 'Seguro Obligatorio', expedient.seguroObligatorio ? 'Sí' : 'No', row + 6, labelStyle);
    this.addRow(sheet, 'Descripción', expedient.vehicleDescription || '—', row + 7, labelStyle);

    sheet.columns = [{ width: 25 }, { width: 35 }, { width: 20 }, { width: 20 }];
  }

  /**
   * Add Personal Data sheet (Titular + Conductor)
   */
  private static addPersonalDataSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Titular y Conductor');
    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    let row = 1;

    // Titular
    sheet.getCell(`A${row}`).value = '👤 DATOS DEL TITULAR';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF2C3E50' } };

    row += 2;
    this.addRow(sheet, 'Nombre Titular', expedient.titularNombre || '—', row, labelStyle);
    this.addRow(sheet, 'DNI/NIE', expedient.titularDNI || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Domicilio', expedient.titularDomicilio || '—', row + 2, labelStyle);
    this.addRow(sheet, 'Localidad', expedient.titularLocalidad || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Provincia', expedient.titularProvincia || '—', row + 4, labelStyle);
    this.addRow(sheet, 'Teléfono', expedient.titularTelefono || '—', row + 5, labelStyle);
    this.addRow(sheet, 'Email', expedient.titularEmail || '—', row + 6, labelStyle);

    // Conductor
    row += 8;
    sheet.getCell(`A${row}`).value = '👨‍✈️ DATOS DEL CONDUCTOR';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF2C3E50' } };

    row += 2;
    this.addRow(sheet, 'Nombre Conductor', expedient.conductorNombre || '—', row, labelStyle);
    this.addRow(sheet, 'DNI/NIE', expedient.conductorDNI || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Número Permiso', expedient.conductorPermiso || '—', row + 2, labelStyle);
    this.addRow(sheet, 'Clase', expedient.conductorClase || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Domicilio', expedient.conductorDomicilio || '—', row + 4, labelStyle);
    this.addRow(sheet, 'Localidad', expedient.conductorLocalidad || '—', row + 5, labelStyle);
    this.addRow(sheet, 'Provincia', expedient.conductorProvincia || '—', row + 6, labelStyle);
    this.addRow(sheet, 'Teléfono', expedient.conductorTelefono || '—', row + 7, labelStyle);
    this.addRow(sheet, 'Email', expedient.conductorEmail || '—', row + 8, labelStyle);

    sheet.columns = [{ width: 25 }, { width: 35 }, { width: 20 }, { width: 20 }];
  }

  /**
   * Add Facts sheet
   */
  private static addFactsSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Hechos y Descripción');

    let row = 1;
    sheet.getCell(`A${row}`).value = '📝 DESCRIPCIÓN DE HECHOS';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;
    sheet.getCell(`A${row}`).value = 'Tipo de Infracción:';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = expedient.violationType;
    sheet.getCell(`B${row}`).alignment = { wrapText: true };

    row += 1;
    sheet.getCell(`A${row}`).value = 'Descripción Detallada:';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = expedient.descripcionDetalladaHechos || '—';
    sheet.getCell(`B${row}`).alignment = { wrapText: true };

    row += 2;
    sheet.getCell(`A${row}`).value = 'Circunstancias Agravantes:';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = expedient.circunstanciasAgravantes || '—';
    sheet.getCell(`B${row}`).alignment = { wrapText: true };

    sheet.columns = [{ width: 25 }, { width: 60 }, { width: 20 }, { width: 20 }];
    sheet.getColumn('B').width = 60;
  }

  /**
   * Add Photos sheet with embedded images
   */
  private static async addPhotosSheet(
    workbook: ExcelJS.Workbook,
    photos: { name: string; base64: string }[]
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Fotos y Evidencia');

    let row = 1;
    sheet.getCell(`A${row}`).value = '📸 IMÁGENES DE EVIDENCIA';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;

    for (const photo of photos) {
      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(photo.base64, 'base64');

        // Add image to workbook
        const imageId = workbook.addImage({
          buffer,
          extension: 'png',
        });

        // Add image to cell
        sheet.addImage(imageId, {
          tl: { col: 0, row: row - 1 },
          ext: { width: 400, height: 300 },
        });

        // Add caption
        sheet.getCell(`B${row + 1}`).value = photo.name;
        sheet.getCell(`B${row + 1}`).font = { bold: true, size: 11 };

        row += 12; // Space for image height
      } catch (error) {
        console.warn(`[ExcelExportService] Error embedding photo ${photo.name}:`, error);
        sheet.getCell(`A${row}`).value = `[Foto: ${photo.name}] - Error al incrustar`;
        row += 2;
      }
    }

    sheet.setPageSetup({ paperSize: 9, orientation: 'landscape' });
    sheet.pageSetup.margins = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 };
  }

  /**
   * Add Audit sheet with history
   */
  private static addAuditSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Auditoría');

    let row = 1;
    sheet.getCell(`A${row}`).value = '📊 HISTORIAL DE TRANSICIONES';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;

    // Header
    const headerStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF34495E' } },
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
    };

    sheet.getCell(`A${row}`).value = 'Fecha/Hora';
    sheet.getCell(`B${row}`).value = 'De Estado';
    sheet.getCell(`C${row}`).value = 'A Estado';
    sheet.getCell(`D${row}`).value = 'Actor';
    sheet.getCell(`E${row}`).value = 'Motivo';

    Object.values(sheet.getRow(row).values || {}).forEach((cell) => {
      if (cell && typeof cell === 'object' && 'font' in cell) {
        Object.assign(cell, headerStyle);
      }
    });

    row += 1;

    // Add transitions
    expedient.stateHistory.forEach((transition) => {
      sheet.getCell(`A${row}`).value = new Date(transition.timestamp).toLocaleString('es-ES');
      sheet.getCell(`B${row}`).value = transition.from;
      sheet.getCell(`C${row}`).value = transition.to;
      sheet.getCell(`D${row}`).value = transition.actor;
      sheet.getCell(`E${row}`).value = transition.reason || '—';
      row += 1;
    });

    // Audit Log
    row += 2;
    sheet.getCell(`A${row}`).value = '📝 LOG DE AUDITORÍA';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11 };

    row += 2;
    sheet.getCell(`A${row}`).value = 'Fecha/Hora';
    sheet.getCell(`B${row}`).value = 'Acción';
    sheet.getCell(`C${row}`).value = 'Actor';
    sheet.getCell(`D${row}`).value = 'Detalles';

    row += 1;

    expedient.auditLog.forEach((entry) => {
      sheet.getCell(`A${row}`).value = new Date(entry.timestamp).toLocaleString('es-ES');
      sheet.getCell(`B${row}`).value = entry.action;
      sheet.getCell(`C${row}`).value = entry.actor;
      sheet.getCell(`D${row}`).value = JSON.stringify(entry.details || {});
      sheet.getCell(`D${row}`).alignment = { wrapText: true };
      row += 1;
    });

    sheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 30 },
    ];
  }

  /**
   * Add Signature sheet
   */
  private static addSignatureSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Firma Digital');

    let row = 1;
    sheet.getCell(`A${row}`).value = '✍️ INFORMACIÓN DE FIRMA';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    row += 2;
    this.addRow(sheet, 'Firmado', expedient.signature.isSigned ? 'Sí ✓' : 'No', row, labelStyle);
    this.addRow(sheet, 'Firmado por', expedient.signature.signedBy || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Fecha Firma', new Date(expedient.signature.signedAt).toLocaleString('es-ES'), row + 2, labelStyle);
    this.addRow(sheet, 'Método', expedient.signature.method, row + 3, labelStyle);
    this.addRow(sheet, 'Hash SHA-256', expedient.signature.signatureHash || '—', row + 4, labelStyle);

    row += 6;
    sheet.getCell(`A${row}`).value = '⚖️ CUMPLIMIENTO LEGAL';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11 };

    row += 2;
    this.addRow(sheet, 'DPIA Certificado', expedient.dpiaCertified ? 'Sí ✓' : 'No', row, labelStyle);
    this.addRow(sheet, 'Retención Datos (días)', expedient.dataRetentionDays?.toString() || '—', row + 1, labelStyle);

    sheet.columns = [{ width: 25 }, { width: 50 }, { width: 20 }, { width: 20 }];
  }

  /**
   * Helper: Add a row with label and value
   */
  private static addRow(
    sheet: ExcelJS.Worksheet,
    label: string,
    value: any,
    row: number,
    labelStyle: any
  ): void {
    sheet.getCell(`A${row}`).value = label;
    Object.assign(sheet.getCell(`A${row}`), labelStyle);

    sheet.getCell(`B${row}`).value = value;
    sheet.getCell(`B${row}`).alignment = { wrapText: true };
  }

  /**
   * Download Excel file to browser
   */
  static downloadExcel(buffer: Buffer, expedientId: string): void {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Expediente_${expedientId.slice(0, 8)}_${new Date().getTime()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
