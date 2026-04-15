import { InfractionLog } from '../types';

type JsPDFType = typeof import('jspdf').jsPDF;

const escapeCsvCell = (value: unknown): string => {
  const normalized = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

const formatTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

const getExpedienteNumber = (): string => {
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const key = `sentinel_exp_${today}`;
  const current = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(current));
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(current).padStart(4, '0')}`;
};

const withImagePrefix = (frame?: string): string | null => {
  if (!frame) return null;
  return frame.startsWith('data:image') ? frame : `data:image/jpeg;base64,${frame}`;
};

const createDoc = async (): Promise<InstanceType<JsPDFType>> => {
  const { jsPDF } = await import('jspdf');
  return new jsPDF('p', 'mm', 'a4');
};

let cachedLogo: string | null = null;
let cachedEscudo: string | null = null;

const loadImage = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getLogo = async (): Promise<string | null> => {
  if (!cachedLogo) cachedLogo = await loadImage('/LOGO PDF.png');
  return cachedLogo;
};

const getEscudo = async (): Promise<string | null> => {
  if (!cachedEscudo) cachedEscudo = await loadImage('/ESCUDO PDF.png');
  return cachedEscudo;
};

const addAnverso = async (doc: InstanceType<JsPDFType>, log: InfractionLog, exp: string) => {
  const logo = await getLogo();
  const escudo = await getEscudo();

  // Header Box
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, 190, 30);

  if (escudo) doc.addImage(escudo, 'PNG', 12, 12, 25, 25);
  if (logo) doc.addImage(logo, 'PNG', 160, 12, 35, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('POLICÍA LOCAL', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('DAGANZO DE ARRIBA', 105, 28, { align: 'center' });

  // 1. DATOS DE LA DENUNCIA
  let y = 45;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('--- DATOS DE LA DENUNCIA ---', 10, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Número de Expediente: ${exp}`, 10, y);
  y += 6;

  const [date, time] = (log.localTime || log.time).split(' ');
  doc.text(`Fecha: ${date || '  /  /    '}          Hora: ${time || '  :  :  '}`, 10, y);
  y += 6;
  doc.text(`Lugar de la Infracción: Casco Urbano / Vía Pública - Daganzo de Arriba`, 10, y);
  y += 10;

  // 2. DATOS DEL VEHÍCULO
  doc.setFont('helvetica', 'bold');
  doc.text('--- DATOS DEL VEHÍCULO ---', 10, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Matrícula: ${log.plate || 'N/D'}`, 10, y);
  doc.text(`Marca/Modelo: ${log.makeModel || 'N/D'}`, 100, y);
  y += 6;
  doc.text(`Color: ${log.color || 'N/D'}`, 10, y);
  doc.text(`Tipo de Vehículo: Turismo / Motocicleta`, 100, y);
  y += 10;

  // 3. HECHO QUE SE DENUNCIA
  doc.setFont('helvetica', 'bold');
  doc.text('--- HECHO QUE SE DENUNCIA Y PRECEPTO VULNERADO ---', 10, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('HECHO DENUNCIADO: ', 10, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const legalText = `El vehículo arriba identificado fue sorprendido realizando ${log.ruleCategory.toLowerCase()} en el lugar y hora indicados. Los hechos han sido captados y acreditados mediante el sistema de videocámaras de vigilancia de tráfico, debidamente autorizado conforme a lo establecido en el Art. 23 del Real Decreto Legislativo 6/2015, de 30 de octubre, por el que se aprueba el Texto Refundido de la Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial (TRLTSV), y en la Instrucción 08/V-74 de la DGT. Las imágenes correspondientes obran en el expediente y están a disposición del interesado.`;
  const legalLines = doc.splitTextToSize(legalText, 190);
  doc.text(legalLines, 10, y + 4);
  y += legalLines.length * 4 + 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `PRECEPTO INFRINGIDO: ${log.legalBase || 'Art. de la Ordenanza Municipal / TRLTSV'}`,
    10,
    y
  );
  y += 8;

  // Estimates for fine
  let amount = 200;
  let points = 0;
  const sev = log.severity as string; // Cast to string for safety if it's coming from AI

  if (sev === 'LOW') {
    amount = 100;
    points = 0;
  } else if (sev === 'MEDIUM' || sev === 'HIGH') {
    amount = 200;
    points = 4;
  } else if (sev === 'CRITICAL') {
    amount = 500;
    points = 6;
  }

  doc.text(`GRAVEDAD: ${sev}`, 10, y);
  doc.text(`CUANTÍA DE LA SANCIÓN: ${amount} €`, 100, y);
  y += 6;
  doc.text(`REDUCCIÓN 50% (pago voluntario en 20 días naturales): ${amount / 2} €`, 10, y);
  y += 6;
  doc.text(`PUNTOS A DETRAER: ${points}`, 10, y);
  y += 12;

  // Images Section - 6 images in 2 rows (3 general + 3 detail)
  const contextImages = (log.extraSnapshots || [])
    .slice(0, 3)
    .map(withImagePrefix)
    .filter(Boolean) as string[];
  const zoomImages = (log.zoomSnapshots || [])
    .slice(0, 3)
    .map(withImagePrefix)
    .filter(Boolean) as string[];

  const imgW = 60;
  const imgH = 35;
  const gap = 5;
  const startX = 10;

  if (contextImages.length > 0 || zoomImages.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('--- PRUEBAS GRÁFICAS ---', 10, y);
    y += 5;

    // Row 1: Context/General images (3 images)
    if (contextImages.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Imágenes Generales', 10, y);
      y += 2;

      contextImages.forEach((img, idx) => {
        doc.addImage(img, 'JPEG', startX + idx * (imgW + gap), y, imgW, imgH);
        doc.rect(startX + idx * (imgW + gap), y, imgW, imgH);
      });
      y += imgH + 5;
    }

    // Row 2: Zoom/Detail images (3 images)
    if (zoomImages.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Imágenes de Detalle (Matrícula/Vehículo)', 10, y);
      y += 2;

      zoomImages.forEach((img, idx) => {
        doc.addImage(img, 'JPEG', startX + idx * (imgW + gap), y, imgW, imgH);
        doc.rect(startX + idx * (imgW + gap), y, imgW, imgH);
      });
      y += imgH + 5;
    }
  }

  // 4. FIRMAS
  doc.setFont('helvetica', 'bold');
  doc.text('--- FIRMAS ---', 10, y);
  y += 6;
  doc.setFontSize(9);
  doc.text('Firma del Agente Denunciante', 10, y);
  doc.text('Firma del Infractor', 110, y); // Though the note says not needed
  y += 20;

  doc.text(`Agente TIP: SENT-AI-01 (Validación Automática)`, 10, y);
  doc.text(`Policía Local de Daganzo de Arriba`, 10, y + 4);

  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const noteText = `Nota: En denuncias por videocámara en las que el denunciado no está presente en el momento de la captación de imágenes, no procede la firma del infractor, ya que la notificación se realiza posteriormente por vía administrativa. Esto es conforme al Art. 90 del TRLTSV y al Art. 43 de la Ley 39/2015 del Procedimiento Administrativo Común.`;
  const noteLines = doc.splitTextToSize(noteText, 190);
  doc.text(noteLines, 10, y);
};

const addInformacionReverso = (doc: InstanceType<JsPDFType>, exp: string) => {
  doc.addPage();
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, 190, 277);

  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const introText = `Usted dispone de un plazo de 20 días naturales, contados desde el día siguiente a la notificación de esta denuncia, para:`;
  doc.text(introText, 15, y);
  y += 6;
  doc.text('1. EFECTUAR EL PAGO VOLUNTARIO CON REDUCCIÓN DEL 50%.', 20, y);
  y += 5;
  doc.text('2. FORMULAR ALEGACIONES O SOLICITAR PRUEBAS.', 20, y);
  y += 10;

  // Section: TRÁMITE PARA EL PAGO
  doc.setFontSize(11);
  doc.text('TRÁMITE PARA EL PAGO (Art. 21 y 94 TGSV)', 15, y);
  doc.line(15, y + 1, 100, y + 1);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const payText = `Si opta por el pago voluntario dentro del plazo, se beneficiará de una reducción del 50% sobre la cuantía de la sanción. El pago implica la renuncia a formular alegaciones y la firmeza de la sanción en vía administrativa.`;
  const payLines = doc.splitTextToSize(payText, 180);
  doc.text(payLines, 15, y);
  y += payLines.length * 4 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text(`CUENTA BANCARIA PARA EL PAGO: ES12 3456 7890 1234 5678 9012`, 15, y);
  y += 5;
  doc.text(`CONCEPTO DE LA TRANSFERENCIA: EXPEDIENTE ${exp}`, 15, y);
  y += 6;

  doc.text('FORMAS DE PAGO:', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('• ONLINE (Portal Ciudadano): www.ayto-daganzo.org', 20, y);
  y += 4;
  doc.text(
    '• PRESENCIAL (Caja Municipal): Plaza de la Villa, 1 - 28814 Daganzo de Arriba (Horario: L-V 9:00 a 14:00 horas)',
    20,
    y
  );
  y += 4;
  doc.text('• TRANSFERENCIA BANCARIA: A la cuenta arriba indicada.', 20, y);
  y += 10;

  // Section: PLAZOS Y RECURSOS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PLAZOS Y RECURSOS (Art. 17 RD 320/1994)', 15, y);
  doc.line(15, y + 1, 100, y + 1);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const recurText = `Si no está de acuerdo con la denuncia y no desea acogerse a la reducción por pago voluntario, dispone de un plazo de 20 días naturales para presentar alegaciones o solicitar pruebas ante la autoridad instructora.`;
  const recurLines = doc.splitTextToSize(recurText, 180);
  doc.text(recurLines, 15, y);
  y += recurLines.length * 4 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('ANTE QUIÉN RECURRIR:', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(
    '• Alegaciones/Recurso de Alzada: 1 mes ante el Ilmo. Sr. Concejal Delegado del Ayuntamiento de Daganzo de Arriba.',
    20,
    y
  );
  y += 4;
  doc.text(
    '• Vía Contencioso-Administrativa: Recurrible ante el Juzgado de lo Contencioso-Administrativo de Madrid.',
    20,
    y
  );
  y += 10;

  // Section: PRESCRIPCIÓN Y EJECUCIÓN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PRESCRIPCIÓN Y EJECUCIÓN', 15, y);
  doc.line(15, y + 1, 70, y + 1);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '• Prescripción de Infracciones: Leves 3 meses, Graves 6 meses, Muy Graves 1 año.',
    15,
    y
  );
  y += 5;
  doc.text('• Prescripción de Sanciones: 1 año (Art. 18 RD 320/1994).', 15, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('RECLAMACIÓN EJECUTIVA:', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const execText = `En caso de impago de la sanción una vez firme, se procederá a la reclamación de la cantidad por vía ejecutiva, con los recargos legales correspondientes y el embargo de bienes (Art. 21 RD 320/1994).`;
  const execLines = doc.splitTextToSize(execText, 180);
  doc.text(execLines, 15, y);

  doc.setFontSize(8);
  doc.text('AYUNTAMIENTO DE DAGANZO DE ARRIBA - POLICÍA LOCAL', 105, 280, { align: 'center' });
};

const buildInfractionPages = async (
  doc: InstanceType<JsPDFType>,
  log: InfractionLog,
  index: number,
  total: number
) => {
  const exp = getExpedienteNumber();
  await addAnverso(doc, log, exp);
  addInformacionReverso(doc, exp);
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
    await buildInfractionPages(doc, log, 1, 1);
    return doc.output('arraybuffer');
  },

  async downloadInfractionPdf(log: InfractionLog, filename?: string): Promise<void> {
    const buffer = await this.generateInfractionPdf(log);
    const expNum = getExpedienteNumber().replace(/\//g, '_');
    const file = filename || `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
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
    const expNum = getExpedienteNumber().replace(/\//g, '_');
    const filename = `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
    const buffer = await this.generateInfractionPdf(log);

    let dateStr;
    if (log.localTime) {
      const match = log.localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }

    const path = await this.savePdfToDisk(buffer, filename, dateStr);
    return { filename, path };
  },

  async generateBatchPdf(
    infractions: InfractionLog[]
  ): Promise<{ buffer: ArrayBuffer; filename: string }> {
    const doc = await createDoc();
    const filename = `Sentinel_Denuncias_${formatTimestamp()}.pdf`;

    for (let i = 0; i < infractions.length; i++) {
      if (i > 0) doc.addPage();
      await buildInfractionPages(doc, infractions[i], i + 1, infractions.length);
    }

    return { buffer: doc.output('arraybuffer'), filename };
  },

  async savePdfToDisk(buffer: ArrayBuffer, filename: string, dateStr?: string): Promise<string> {
    const query = new URLSearchParams({ filename });
    if (dateStr) query.append('date', dateStr);
    const response = await fetch(`/api/reports/save?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`No se pudo guardar el PDF en el servidor`);
    }

    const data = await response.json();
    return data.path as string;
  },

  async saveVideoToDisk(buffer: ArrayBuffer, filename: string, dateStr?: string): Promise<string> {
    const query = new URLSearchParams({ filename });
    if (dateStr) query.append('date', dateStr);
    const response = await fetch(`/api/reports/video?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`No se pudo guardar el Video en el servidor`);
    }

    const data = await response.json();
    return data.path as string;
  },

  async generateAndSaveBatchPdf(
    infractions: InfractionLog[]
  ): Promise<{ filename: string; path: string }> {
    const { buffer, filename } = await this.generateBatchPdf(infractions);

    let dateStr;
    if (infractions.length > 0 && infractions[0].localTime) {
      const match = infractions[0].localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }

    const path = await this.savePdfToDisk(buffer, filename, dateStr);
    return { filename, path };
  },
};
