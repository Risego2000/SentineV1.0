import { InfractionLog } from '../types';

type JsPDFType = typeof import('jspdf').jsPDF;

const escapeCsvCell = (value: unknown): string => {
  const normalized = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

const REPORTS_DIR = 'C:\\Denuncias';

const formatTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

const withImagePrefix = (frame?: string): string | null => {
  if (!frame) return null;
  return frame.startsWith('data:image') ? frame : `data:image/jpeg;base64,${frame}`;
};

const createDoc = async (): Promise<InstanceType<JsPDFType>> => {
  const { jsPDF } = await import('jspdf');
  return new jsPDF('p', 'mm', 'a4');
};

const addHeader = (
  doc: InstanceType<JsPDFType>,
  title: string,
  subtitle: string,
  pageLabel?: string
) => {
  doc.setFillColor(5, 9, 20);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(180, 185, 195);
  doc.text(subtitle, 14, 24);
  if (pageLabel) {
    doc.text(pageLabel, 170, 24);
  }
};

const addImageStrip = (
  doc: InstanceType<JsPDFType>,
  title: string,
  frames: string[],
  startY: number
): number => {
  if (!frames.length) return startY;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(title, 14, startY);

  const boxW = 58;
  const boxH = 34;
  const x = 14;
  const y = startY + 4;

  frames.slice(0, 3).forEach((frame, index) => {
    const image = withImagePrefix(frame);
    if (!image) return;

    doc.setDrawColor(200, 205, 214);
    doc.roundedRect(x + index * (boxW + 6), y, boxW, boxH, 2, 2);
    doc.addImage(image, 'JPEG', x + index * (boxW + 6) + 1, y + 1, boxW - 2, boxH - 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${index + 1}`, x + index * (boxW + 6), y - 1);
  });

  return y + boxH + 8;
};

const addKeyValues = (
  doc: InstanceType<JsPDFType>,
  entries: Array<[string, string]>,
  startY: number
): number => {
  let y = startY;
  doc.setFontSize(10);
  entries.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 14 : 108;
    if (index % 2 === 0 && index > 0) y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(value || 'N/D', 78), x + 22, y);
  });

  return y + 10;
};

const buildInfractionPages = (
  doc: InstanceType<JsPDFType>,
  log: InfractionLog,
  index: number,
  total: number
) => {
  addHeader(
    doc,
    'SENTINEL AI - EXPEDIENTE DE INFRACCION',
    `Vehiculo ${log.plate || 'DESCONOCIDO'} | ${log.ruleCategory}`,
    `${index}/${total}`
  );

  let y = 44;

  y = addKeyValues(
    doc,
    [
      ['Matricula IA', log.plate || 'DESCONOCIDO'],
      ['OCR matricula', log.plateOcr || 'SIN LECTURA'],
      ['Marca/modelo', log.makeModel || 'DESCONOCIDO'],
      ['Color', log.color || 'DESCONOCIDO'],
      ['Gravedad', log.severity],
      ['Base legal', log.legalBase || 'Revision manual'],
      ['Tiempo video', log.videoTimeCode || log.time],
      ['Tiempo local', log.localTime || log.time],
    ],
    y
  );

  if (log.plateOcrCandidates?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Candidatos OCR:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(log.plateOcrCandidates.join(' | '), 42, y);
    y += 8;
  }

  y = addImageStrip(doc, 'Escena contextual', log.extraSnapshots || [], y);
  y = addImageStrip(doc, 'Zoom del vehiculo infractor', log.zoomSnapshots || [], y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Descripcion tecnica', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const description = doc.splitTextToSize(log.description || 'Sin descripcion', 182);
  doc.text(description, 14, y);
  y += description.length * 5 + 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Razonamiento pericial', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  (log.reasoning || []).forEach((reason, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${reason}`, 182);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 1;
  });
};

const bufferToBlob = (buffer: ArrayBuffer): Blob => new Blob([buffer], { type: 'application/pdf' });

export const ReportService = {
  async exportToCsv(infractions: InfractionLog[], filename = 'Sentinel_Report_Batch.csv') {
    if (infractions.length === 0) return;

    const rows = infractions.map((inf) => ({
      ID: inf.id,
      'Fecha Local': inf.localTime || inf.time,
      'Tiempo Video (OSD)': inf.videoTimeCode || 'N/A',
      'Marca/Modelo': inf.makeModel,
      'Placa/Matrícula': inf.plate,
      'OCR Matrícula': inf.plateOcr || '',
      Color: inf.color,
      Categoría: inf.ruleCategory,
      Gravedad: inf.severity,
      Descripción: inf.description,
      'Base Legal': inf.legalBase,
      'Timestamp Visual': inf.visualTimestamp,
      'Velocidad Estimada': inf.telemetry.speedEstimated,
    }));

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(',')
      ),
    ];

    const blob = new Blob([`\uFEFF${csvLines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  async generateInfractionPdf(log: InfractionLog): Promise<ArrayBuffer> {
    const doc = await createDoc();
    buildInfractionPages(doc, log, 1, 1);
    return doc.output('arraybuffer');
  },

  async downloadInfractionPdf(log: InfractionLog, filename?: string): Promise<void> {
    const buffer = await this.generateInfractionPdf(log);
    const file = filename || `Expediente_Digital_${log.plate || 'SENT'}_${log.id}.pdf`;
    const url = URL.createObjectURL(bufferToBlob(buffer));
    const link = document.createElement('a');
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
  },

  async generateAndSaveInfractionPdf(
    log: InfractionLog
  ): Promise<{ filename: string; path: string }> {
    const filename = `Expediente_Digital_${log.plate || 'SENT'}_${log.id}.pdf`;
    const buffer = await this.generateInfractionPdf(log);
    const path = await this.savePdfToDisk(buffer, filename);
    return { filename, path };
  },

  async generateBatchPdf(
    infractions: InfractionLog[],
    title = 'SENTINEL AI - INFORME CONSOLIDADO DE DENUNCIAS'
  ): Promise<{ buffer: ArrayBuffer; filename: string }> {
    const doc = await createDoc();
    const generatedAt = new Date().toLocaleString('es-ES');
    const filename = `Sentinel_Denuncias_${formatTimestamp()}.pdf`;

    addHeader(doc, title, `Generado ${generatedAt}`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(`Total de infracciones: ${infractions.length}`, 14, 48);

    let y = 58;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    infractions.forEach((inf, index) => {
      const line = `${index + 1}. ${inf.ruleCategory} | ${inf.plate || 'DESCONOCIDO'} | ${inf.localTime || inf.time}`;
      doc.text(doc.splitTextToSize(line, 180), 14, y);
      y += 8;
      if (y > 270 && index < infractions.length - 1) {
        doc.addPage();
        addHeader(doc, title, `Resumen continuacion ${generatedAt}`);
        y = 44;
      }
    });

    infractions.forEach((inf, index) => {
      doc.addPage();
      buildInfractionPages(doc, inf, index + 1, infractions.length);
    });

    return { buffer: doc.output('arraybuffer'), filename };
  },

  async savePdfToDisk(buffer: ArrayBuffer, filename: string): Promise<string> {
    const response = await fetch(`/api/reports/save?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`No se pudo guardar el PDF en ${REPORTS_DIR}`);
    }

    const data = await response.json();
    return data.path as string;
  },

  async saveVideoToDisk(buffer: ArrayBuffer, filename: string): Promise<string> {
    const response = await fetch(`/api/reports/video?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/webm',
      },
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`No se pudo guardar el Video en ${REPORTS_DIR}`);
    }

    const data = await response.json();
    return data.path as string;
  },

  async generateAndSaveBatchPdf(
    infractions: InfractionLog[]
  ): Promise<{ filename: string; path: string }> {
    const { buffer, filename } = await this.generateBatchPdf(infractions);
    const path = await this.savePdfToDisk(buffer, filename);
    return { filename, path };
  },
};
