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

      // Sheet 6: Marco Jurídico completo
      this.addLegalSheet(workbook, expedient);

      // Sheet 7: Evidencia (Fotos)
      if (photos && photos.length > 0) {
        await this.addPhotosSheet(workbook, photos);
      }

      // Sheet 8: Auditoría y Historial
      this.addAuditSheet(workbook, expedient);

      // Sheet 9: Firma Digital
      this.addSignatureSheet(workbook, expedient);

      // Sheet 10: Datos generados por la aplicación (OCR/IA/flujo/evidencia)
      this.addAppGeneratedSheet(workbook, expedient, photos);

      // Sheet 11: Volcado completo del expediente (todos los campos, incl. anidados)
      this.addCompleteDumpSheet(workbook, expedient);

      // Generar buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as Buffer;
    } catch (error) {
      console.error('[ExcelExportService] Error generating Excel:', error);
      return null;
    }
  }

  private static addAppGeneratedSheet(
    workbook: ExcelJS.Workbook,
    expedient: Expedient,
    photos?: { name: string; base64: string }[]
  ): void {
    const sheet = workbook.addWorksheet('App Generada');
    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    let row = 1;
    sheet.getCell(`A${row}`).value = '🧠 DATOS GENERADOS POR LA APLICACIÓN';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;
    this.addRow(sheet, 'Estado', expedient.state, row, labelStyle);
    this.addRow(sheet, 'Validation Status', expedient.validationStatus || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Rule Category', expedient.ruleCategory || '—', row + 2, labelStyle);
    this.addRow(sheet, 'Operative Code', expedient.operativeCode || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Prioridad', expedient.priority || '—', row + 4, labelStyle);
    this.addRow(
      sheet,
      'Priority Level',
      expedient.priorityLevel?.toString() || '—',
      row + 5,
      labelStyle
    );

    row += 7;
    this.addRow(sheet, 'OCR Placa', expedient.plateOcr || '—', row, labelStyle);
    this.addRow(
      sheet,
      'OCR Candidatos',
      expedient.plateOcrCandidates?.join(' | ') || '—',
      row + 1,
      labelStyle
    );
    this.addRow(
      sheet,
      'OCR Resultados',
      expedient.ocrResults?.join(' | ') || '—',
      row + 2,
      labelStyle
    );
    this.addRow(sheet, 'Video Time Code', expedient.videoTimeCode || '—', row + 3, labelStyle);
    this.addRow(sheet, 'Visual Timestamp', expedient.visualTimestamp || '—', row + 4, labelStyle);
    this.addRow(
      sheet,
      'Playback Time',
      expedient.playbackTime?.toString() || '—',
      row + 5,
      labelStyle
    );

    row += 7;
    this.addRow(sheet, 'Severity IA', expedient.severity || '—', row, labelStyle);
    this.addRow(sheet, 'Descripción IA', expedient.description || '—', row + 1, labelStyle);
    this.addRow(sheet, 'Base Legal IA', expedient.legalBase || '—', row + 2, labelStyle);
    this.addRow(
      sheet,
      'Reasoning IA',
      expedient.reasoning?.join(' | ') || '—',
      row + 3,
      labelStyle
    );
    this.addRow(
      sheet,
      'Telemetry Speed',
      expedient.telemetrySpeedEstimated || '—',
      row + 4,
      labelStyle
    );
    this.addRow(
      sheet,
      'Telemetry Anomalies',
      expedient.telemetryBehaviorAnomalies || '—',
      row + 5,
      labelStyle
    );

    row += 7;
    this.addRow(sheet, 'Evidence ID', expedient.evidenceId || '—', row, labelStyle);
    this.addRow(sheet, 'Video Clip Hash', expedient.videoClipHash || '—', row + 1, labelStyle);
    this.addRow(
      sheet,
      'Photos Count',
      expedient.photosCount?.toString() || '0',
      row + 2,
      labelStyle
    );
    this.addRow(sheet, 'Main Image Present', expedient.image ? 'Sí' : 'No', row + 3, labelStyle);
    this.addRow(
      sheet,
      'General Snapshots',
      (expedient.extraSnapshots?.length || 0).toString(),
      row + 4,
      labelStyle
    );
    this.addRow(
      sheet,
      'Detail Snapshots',
      (expedient.zoomSnapshots?.length || 0).toString(),
      row + 5,
      labelStyle
    );
    this.addRow(
      sheet,
      'Video Clip Present',
      expedient.videoClip ? 'Sí' : 'No',
      row + 6,
      labelStyle
    );
    this.addRow(
      sheet,
      'Fotos Embebidas en XLS',
      (photos?.length || 0).toString(),
      row + 7,
      labelStyle
    );

    row += 9;
    this.addRow(
      sheet,
      'Custody Last Checked At',
      expedient.custodyLastCheckedAt
        ? new Date(expedient.custodyLastCheckedAt).toLocaleString('es-ES')
        : '—',
      row,
      labelStyle
    );
    this.addRow(
      sheet,
      'Custody Last Status',
      expedient.custodyLastStatus || '—',
      row + 1,
      labelStyle
    );
    this.addRow(
      sheet,
      'Custody Last Summary',
      expedient.custodyLastSummary || '—',
      row + 2,
      labelStyle
    );
    this.addRow(
      sheet,
      'Custody Verification Rows',
      expedient.custodyVerificationRows?.length
        ? JSON.stringify(expedient.custodyVerificationRows)
        : '—',
      row + 3,
      labelStyle
    );

    sheet.columns = [{ width: 34 }, { width: 110 }];
    sheet.getColumn('B').alignment = { wrapText: true, vertical: 'top' };
  }

  private static addCompleteDumpSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Expediente Completo');
    sheet.getCell('A1').value = '🗂️ VOLCADO COMPLETO DEL EXPEDIENTE';
    sheet.getCell('A1').font = { bold: true, size: 12 };

    const rows = this.flattenObject(expedient);
    let row = 3;
    sheet.getCell(`A${row}`).value = 'Campo';
    sheet.getCell(`B${row}`).value = 'Valor';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).font = { bold: true };
    row += 1;

    for (const entry of rows) {
      sheet.getCell(`A${row}`).value = entry.key;
      sheet.getCell(`B${row}`).value = entry.value;
      sheet.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'top' };
      row += 1;
    }

    sheet.columns = [{ width: 42 }, { width: 120 }];
    sheet.getColumn('B').alignment = { wrapText: true, vertical: 'top' };
  }

  private static flattenObject(obj: any, prefix = ''): Array<{ key: string; value: string }> {
    const out: Array<{ key: string; value: string }> = [];
    if (obj === null || obj === undefined) {
      out.push({ key: prefix || '(root)', value: 'null' });
      return out;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        out.push({ key: prefix, value: '[]' });
        return out;
      }
      obj.forEach((item, idx) => {
        const key = `${prefix}[${idx}]`;
        if (item && typeof item === 'object') {
          out.push(...this.flattenObject(item, key));
        } else {
          out.push({ key, value: String(item) });
        }
      });
      return out;
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        out.push({ key: prefix, value: '{}' });
        return out;
      }
      for (const key of keys) {
        const value = obj[key];
        const next = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object') {
          out.push(...this.flattenObject(value, next));
        } else {
          out.push({ key: next, value: value === undefined ? 'undefined' : String(value) });
        }
      }
      return out;
    }

    out.push({ key: prefix, value: String(obj) });
    return out;
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
    this.addRow(
      sheet,
      'Fecha Creación',
      new Date(expedient.createdAt).toLocaleString('es-ES'),
      row + 2,
      labelStyle
    );
    this.addRow(
      sheet,
      'Última Actualización',
      new Date(expedient.updatedAt).toLocaleString('es-ES'),
      row + 3,
      labelStyle
    );
    this.addRow(sheet, 'Estado', expedient.state, row + 4, labelStyle);

    // Infracción
    row += 6;
    this.addRow(sheet, 'Tipo de Infracción', expedient.violationType, row, labelStyle);
    this.addRow(sheet, 'Ubicación', expedient.location, row + 1, labelStyle);
    this.addRow(
      sheet,
      'Fecha/Hora Infracción',
      new Date(expedient.timestamp).toLocaleString('es-ES'),
      row + 2,
      labelStyle
    );
    const placaDetectada = expedient.plateOcr || expedient.licensePlate;
    this.addRow(sheet, 'Matrícula Detectada (OCR)', placaDetectada, row + 3, labelStyle);
    this.addRow(sheet, 'Matrícula Base', expedient.licensePlate, row + 4, labelStyle);
    this.addRow(
      sheet,
      'Candidatos OCR',
      expedient.plateOcrCandidates?.join(', ') || '—',
      row + 5,
      labelStyle
    );

    // Operador y Supervisor
    row += 7;
    this.addRow(sheet, 'Operador', expedient.operator || '—', row, labelStyle);
    this.addRow(sheet, 'Supervisor', expedient.supervisor || '—', row + 1, labelStyle);

    sheet.columns = [{ width: 25 }, { width: 35 }, { width: 20 }, { width: 20 }];
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
    this.addRow(
      sheet,
      'KM/Punto Kilométrico',
      expedient.numeroPuntoKilometrico || '—',
      row + 1,
      labelStyle
    );
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
    this.addRow(
      sheet,
      'Seguro Obligatorio',
      expedient.seguroObligatorio ? 'Sí' : 'No',
      row + 6,
      labelStyle
    );
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

    row += 2;
    sheet.getCell(`A${row}`).value = 'Descripción IA / Preinforme:';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = expedient.description || '—';
    sheet.getCell(`B${row}`).alignment = { wrapText: true };

    row += 1;
    sheet.getCell(`A${row}`).value = 'Base Legal IA:';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = expedient.legalBase || '—';
    sheet.getCell(`B${row}`).alignment = { wrapText: true };

    sheet.columns = [{ width: 25 }, { width: 60 }, { width: 20 }, { width: 20 }];
    sheet.getColumn('B').width = 60;
  }

  private static addLegalSheet(workbook: ExcelJS.Workbook, expedient: Expedient): void {
    const sheet = workbook.addWorksheet('Marco Jurídico');
    const labelStyle = {
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFECF0F1' } },
      font: { bold: true },
    };

    let row = 1;
    sheet.getCell(`A${row}`).value = '⚖️ MARCO JURÍDICO COMPLETO';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

    row += 2;
    this.addRow(sheet, 'Tipo / ID Infracción', expedient.violationType || '—', row, labelStyle);
    this.addRow(
      sheet,
      'Definición de la Infracción',
      expedient.definicionInfraccion || '—',
      row + 1,
      labelStyle
    );
    this.addRow(
      sheet,
      'Conducta Denunciada',
      expedient.conductaDenunciada || '—',
      row + 2,
      labelStyle
    );
    this.addRow(sheet, 'Código de Señal', expedient.codigoSenal || '—', row + 3, labelStyle);
    this.addRow(
      sheet,
      'Descripción de Señal',
      expedient.descripcionSenal || '—',
      row + 4,
      labelStyle
    );

    row += 6;
    this.addRow(sheet, 'Norma de Conducta', expedient.normaConductaNombre || '—', row, labelStyle);
    this.addRow(
      sheet,
      'Abreviatura Conducta',
      expedient.normaConductaAbreviatura || '—',
      row + 1,
      labelStyle
    );
    this.addRow(sheet, 'Artículo Conducta', expedient.articuloConducta || '—', row + 2, labelStyle);
    this.addRow(
      sheet,
      'Texto Articulado Conducta',
      expedient.articuloConductaTexto || '—',
      row + 3,
      labelStyle
    );

    row += 5;
    this.addRow(
      sheet,
      'Norma Sancionadora',
      expedient.normaSancionadoraNombre || '—',
      row,
      labelStyle
    );
    this.addRow(
      sheet,
      'Abreviatura Sancionadora',
      expedient.normaSancionadoraAbreviatura || '—',
      row + 1,
      labelStyle
    );
    this.addRow(
      sheet,
      'Artículo Sancionador',
      expedient.articuloSancionador || '—',
      row + 2,
      labelStyle
    );
    this.addRow(
      sheet,
      'Texto Articulado Sancionador',
      expedient.articuloSancionadorTexto || '—',
      row + 3,
      labelStyle
    );

    row += 5;
    this.addRow(sheet, 'Sanción (€)', expedient.sancionEuros?.toString() || '—', row, labelStyle);
    this.addRow(
      sheet,
      'Puntos de Detracción',
      expedient.puntosDetraccion?.toString() || '—',
      row + 1,
      labelStyle
    );
    this.addRow(
      sheet,
      'Nivel de Riesgo',
      expedient.riesgoNivel?.toString() || '—',
      row + 2,
      labelStyle
    );
    this.addRow(sheet, 'Prioridad', expedient.priority || '—', row + 3, labelStyle);

    sheet.columns = [{ width: 32 }, { width: 90 }, { width: 20 }, { width: 20 }];
    sheet.getColumn('B').alignment = { wrapText: true, vertical: 'top' };
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

    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 },
    };
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

    sheet.columns = [{ width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 30 }];
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
    this.addRow(
      sheet,
      'Fecha Firma',
      new Date(expedient.signature.signedAt).toLocaleString('es-ES'),
      row + 2,
      labelStyle
    );
    this.addRow(sheet, 'Método', expedient.signature.method, row + 3, labelStyle);
    this.addRow(
      sheet,
      'Hash SHA-256',
      expedient.signature.signatureHash || '—',
      row + 4,
      labelStyle
    );

    row += 6;
    sheet.getCell(`A${row}`).value = '⚖️ CUMPLIMIENTO LEGAL';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11 };

    row += 2;
    this.addRow(
      sheet,
      'DPIA Certificado',
      expedient.dpiaCertified ? 'Sí ✓' : 'No',
      row,
      labelStyle
    );
    this.addRow(
      sheet,
      'Retención Datos (días)',
      expedient.dataRetentionDays?.toString() || '—',
      row + 1,
      labelStyle
    );

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
