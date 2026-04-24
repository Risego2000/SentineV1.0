import { InfractionLog } from '../types';
import { getApiUrl } from './apiConfig';

type JsPDFType = typeof import('jspdf').jsPDF;

// ===== CONSTANTS =====
const PAGE_W = 210;
const PAGE_H = 297;
const M = 10;
const CONTENT_W = PAGE_W - M * 2;
const HEADER_H = 28;
const FOOTER_Y = 280;

// ===== HELPER FUNCTIONS =====

const pad = (value: number): string => String(value).padStart(2, '0');

const formatDate = (date: Date): string =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

const formatTime = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const formatDateTime = (date: Date): string => `${formatDate(date)} ${formatTime(date)}`;

const formatTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

const parseMaybeDate = (value?: string): Date | null => {
  if (!value) return null;
  const spanishMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (spanishMatch) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = spanishMatch;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const normalized = value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getInfractionDate = (log: InfractionLog): Date =>
  parseMaybeDate(log.localTime) || parseMaybeDate(log.time) || new Date();

const getExpedienteNumber = (): string => {
  const now = new Date();
  const today = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const key = `sentinel_exp_${today}`;
  const current = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(current));
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${String(current).padStart(4, '0')}`;
};

const escapeCsvCell = (value: unknown): string => {
  const normalized = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
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

const getSeverityInfo = (severity: InfractionLog['severity']) => {
  if (severity === 'CRITICAL') {
    return { label: 'Muy Grave', amount: 500, reduction: 250, points: 6 };
  }
  if (severity === 'HIGH' || severity === 'MEDIUM') {
    return { label: 'Grave', amount: 200, reduction: 100, points: 4 };
  }
  return { label: 'Leve', amount: 100, reduction: 50, points: 0 };
};

const getVehicleParts = (makeModel?: string) => {
  if (!makeModel) return { brand: '', model: '' };
  const tokens = makeModel.trim().split(/\s+/);
  if (tokens.length === 1) return { brand: tokens[0], model: tokens[0] };
  return { brand: tokens[0], model: tokens.slice(1).join(' ') || tokens[0] };
};

const inferVehicleType = (makeModel?: string): string => {
  const value = (makeModel || '').toLowerCase();
  if (value.includes('moto') || value.includes('scooter')) return 'Motocicleta';
  if (value.includes('furg') || value.includes('van')) return 'Furgoneta';
  if (value.includes('bus') || value.includes('autob')) return 'Autobús';
  if (value.includes('camion') || value.includes('truck')) return 'Camión';
  return 'Turismo';
};

// ===== PDF DRAWING HELPERS =====

const drawLine = (doc: InstanceType<JsPDFType>, x: number, y: number, width: number, color: [number, number, number] = [190, 200, 215]) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + width, y);
};

const drawFieldLine = (doc: InstanceType<JsPDFType>, x: number, y: number, width: number, label: string, value: string) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(70, 70, 70);
  doc.text(label.toUpperCase(), x, y);
  drawLine(doc, x, y + 6.5, width);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text(value || '—', x, y + 4.5, { maxWidth: width });
  doc.setTextColor(0, 0, 0);
};

const drawHeader = async (doc: InstanceType<JsPDFType>, pageNumber: number, totalPages: number) => {
  const escudo = await getEscudo();
  if (escudo) doc.addImage(escudo, 'PNG', 11, 8.5, 18, 18);

  doc.setDrawColor(150, 162, 182);
  doc.setLineWidth(0.5);
  doc.line(34, 10, 34, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(70, 70, 70);
  doc.text('AYUNTAMIENTO DE DAGANZO DE ARRIBA', 38, 12.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 45, 70);
  doc.text('Jefatura de Policía Local', 38, 18.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(95, 95, 95);
  doc.text(
    'Concejalía de Seguridad Ciudadana, Protección Civil y Emergencias, Nuevas Tecnologías y Transporte y Movilidad',
    38,
    22.3
  );

  doc.setDrawColor(33, 65, 105);
  doc.setLineWidth(0.6);
  doc.line(12, HEADER_H, PAGE_W - 12, HEADER_H);

  doc.setFillColor(33, 65, 105);
  doc.rect(PAGE_W - 56, 11.5, 39, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('BOLETÍN DE DENUNCIA', PAGE_W - 36.5, 16.1, { align: 'center' });

  doc.setFillColor(33, 65, 105);
  doc.rect(12, FOOTER_Y, PAGE_W - 24, 8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(235, 240, 248);
  doc.text('Documento oficial · Validez jurídica conforme a RDL 6/2015 · RD 320/1994 · Ley 39/2015', 17, FOOTER_Y + 3.4);
  doc.text('Modelo Normalizado · Jefatura de Policía Local · Glorieta de Alcalá s/n · 28814 Daganzo de Arriba (Madrid) · policia@ayto-daganzo.org · Tel. 91 887 59 19 · www.ayto-daganzo.org', 17, FOOTER_Y + 6.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`Pag. ${pad(pageNumber)}/${pad(totalPages)}`, PAGE_W - 17, FOOTER_Y + 5.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
};

const drawSectionTitle = (doc: InstanceType<JsPDFType>, index: string, title: string, y: number, subtitle?: string): number => {
  doc.setFillColor(33, 65, 105);
  doc.rect(12, y, PAGE_W - 24, 6, 'F');
  doc.setFillColor(64, 97, 138);
  doc.rect(15, y + 0.8, 4.7, 4.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(index, 17.35, y + 3.8, { align: 'center' });
  doc.text(title.toUpperCase(), 21.8, y + 4.1);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.text(subtitle, PAGE_W - 16, y + 4.1, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  return y + 7;
};

const drawParagraphBox = (doc: InstanceType<JsPDFType>, x: number, y: number, width: number, height: number, title: string, text: string) => {
  doc.setDrawColor(200, 210, 224);
  doc.setLineWidth(0.25);
  doc.rect(x, y, width, height);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.9);
  doc.setTextColor(53, 93, 139);
  doc.text(title.toUpperCase(), x + 2, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(45, 45, 45);
  const lines = doc.splitTextToSize(text || '—', width - 4);
  doc.text(lines, x + 2, y + 9, { maxWidth: width - 4 });
  doc.setTextColor(0, 0, 0);
};

const drawLabeledImage = (doc: InstanceType<JsPDFType>, imgData: string | null, x: number, y: number, w: number, h: number, label: string, caption?: string) => {
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h);
  doc.setFillColor(245, 245, 245);
  doc.rect(x + 0.5, y + 0.5, w - 1, h - 1, 'F');

  if (imgData) {
    try {
      const format = imgData.includes('image/png') ? 'PNG' : 'JPEG';
      const props = doc.getImageProperties(imgData);
      const innerW = w - 1;
      const innerH = h - 1;
      const scale = Math.min(innerW / props.width, innerH / props.height);
      const drawW = props.width * scale;
      const drawH = props.height * scale;
      const drawX = x + 0.5 + (innerW - drawW) / 2;
      const drawY = y + 0.5 + (innerH - drawH) / 2;
      doc.addImage(imgData, format, drawX, drawY, drawW, drawH);
    } catch {
      // Keep neutral placeholder background
    }
  }

  doc.setFillColor(255, 255, 255);
  doc.rect(x + 1, y + 1, Math.min(w - 2, 34), 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(33, 65, 105);
  doc.text(label, x + 2, y + 4.4);
  if (caption) {
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 1, y + h - 8, w - 2, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(70, 70, 70);
    const captionLines = doc.splitTextToSize(caption, w - 4);
    doc.text(captionLines, x + 2, y + h - 4.2, { maxWidth: w - 4 });
  }
  doc.setTextColor(0, 0, 0);
};

// ===== MAIN PDF BUILDING FUNCTIONS =====

const buildInfractionPages = async (
  doc: InstanceType<JsPDFType>,
  log: InfractionLog,
  filename: string,
  exp: string
): Promise<void> => {
  const totalPages = 5;
  const infractionDate = getInfractionDate(log);
  const severity = getSeverityInfo(log.severity);
  const { brand, model } = getVehicleParts(log.makeModel);

  // ===== PAGE 1: ANVERSO - MAIN INFRACTION DATA =====
  await drawHeader(doc, 1, totalPages);
  let y = 32;

  // Base fields
  drawFieldLine(doc, 16, y, 30, 'Expediente Nº', exp);
  drawFieldLine(doc, 50, y, 30, 'Fecha Emisión', formatDate(new Date()));
  drawFieldLine(doc, 84, y, 30, 'Fecha Denuncia', formatDate(infractionDate));
  drawFieldLine(doc, 118, y, 30, 'Hora Infracción', log.videoTimeCode || formatTime(infractionDate));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(53, 93, 139);
  doc.text('GRAVEDAD:', 152, y);
  doc.text(severity.label.toUpperCase(), 152, y + 6);
  doc.setTextColor(0, 0, 0);

  y = 43;
  y = drawSectionTitle(doc, '01', 'Lugar y Circunstancias de la Infracción', y);

  drawFieldLine(doc, 16, y + 2, 108, 'Vía / Calle / Carretera', 'Casco urbano / vía pública');
  drawFieldLine(doc, 128, y + 2, 64, 'KM / Nº / Punto Kilométrico', log.playbackTime != null ? `Playback ${log.playbackTime.toFixed(2)} s` : 'N/D');
  drawFieldLine(doc, 16, y + 16, 56, 'Término Municipal', 'Daganzo de Arriba');
  drawFieldLine(doc, 75, y + 16, 26, 'Provincia', 'Madrid');
  drawFieldLine(doc, 128, y + 16, 64, 'Coordenadas GPS (Lat / Long)', log.visualTimestamp || '');

  y += 26;
  y = drawSectionTitle(doc, '02', 'Identificación del Vehículo', y);

  drawFieldLine(doc, 16, y + 2, 40, 'Matrícula', log.plate || '');
  drawFieldLine(doc, 59, y + 2, 39, 'Tipo de Vehículo', inferVehicleType(log.makeModel));
  drawFieldLine(doc, 101, y + 2, 39, 'Marca', brand);
  drawFieldLine(doc, 143, y + 2, 49, 'Modelo', model);
  drawFieldLine(doc, 16, y + 16, 40, 'Color', log.color || '');
  drawFieldLine(doc, 59, y + 16, 66, 'Nº de Bastidor (VIN)', '');
  drawFieldLine(doc, 143, y + 16, 49, 'ITV - En vigor hasta', '');
  drawFieldLine(doc, 16, y + 29, 84, 'Seguro obligatorio', '');
  drawFieldLine(doc, 103, y + 29, 89, 'Estado ITV', '');

  y += 39;
  y = drawSectionTitle(doc, '03', 'Datos del Titular del Vehículo', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text('', 16, y + 5);
  doc.text('(Se completa tras verificación de registros)', 16, y + 11);
  doc.setTextColor(0, 0, 0);

  y += 25;
  y = drawSectionTitle(doc, '3B', 'Diligencia de Identificación del Conductor (Art. 9 BIS TRLTSV)', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text('Para infracciones sin detención del vehículo ni presencia del conductor.', 16, y + 5);
  doc.text('El titular deberá identificar al conductor en plazo de 20 días naturales.', 16, y + 10);
  doc.setTextColor(0, 0, 0);

  y += 20;
  y = drawSectionTitle(doc, '04', 'Hecho Denunciado y Precepto Vulnerado', y);

  drawParagraphBox(doc, 16, y + 1, 176, 10, 'Descripción de los hechos', log.ruleCategory || '');
  drawParagraphBox(doc, 16, y + 12, 176, 15, 'Descripción detallada', log.description || '');

  drawFieldLine(doc, 16, y + 32, 80, 'Normativa Aplicable', 'TRLTSV · RD 320/1994 · Ley 39/2015');
  drawFieldLine(doc, 100, y + 32, 92, 'Artículo / Apartado', log.legalBase || '');
  drawFieldLine(doc, 16, y + 45, 176, 'Precepto Vulnerado', log.legalBase || '');

  // Reasoning points
  if (log.reasoning && log.reasoning.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(53, 93, 139);
    doc.text('PUNTOS DE CONFIRMACIÓN:', 16, y + 53);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(60, 60, 60);

    let reasonY = y + 58;
    log.reasoning.slice(0, 3).forEach((reason, idx) => {
      const reasonLines = doc.splitTextToSize(`${idx + 1}. ${reason}`, 176);
      doc.text(reasonLines, 18, reasonY, { maxWidth: 174 });
      reasonY += Math.max(3, reasonLines.length * 3.5);
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4);
  doc.setTextColor(100, 100, 100);
  doc.text('CONSTANCIA: Constatados mediante SACRI - Sistema automático de captación de imágenes homologado conforme a art. 23 RDL 6/2015', 16, 272, { maxWidth: 178 });
  doc.setTextColor(0, 0, 0);

  // ===== PAGE 2: SANCIONES AND PHOTOS =====
  doc.addPage();
  await drawHeader(doc, 2, totalPages);

  y = 32;
  y = drawSectionTitle(doc, '05', 'Sanción Propuesta', y);

  // Sanction cards
  const drawSanctionCard = (x: number, title: string, value: string, note: string) => {
    doc.setDrawColor(160, 175, 195);
    doc.rect(x, y + 2, 50, 18);
    doc.setFillColor(244, 247, 251);
    doc.rect(x, y + 2, 50, 18, 'F');
    doc.setDrawColor(160, 175, 195);
    doc.rect(x, y + 2, 50, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(53, 93, 139);
    doc.text(title.toUpperCase(), x + 25, y + 6.4, { align: 'center' });
    drawLine(doc, x + 7, y + 13, 36, [145, 160, 182]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(35, 35, 35);
    doc.text(value, x + 25, y + 11.8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text(note, x + 25, y + 17.8, { align: 'center' });
  };

  drawSanctionCard(19, 'Importe Íntegro', `${severity.amount}€`, 'Euros');
  drawSanctionCard(72, 'Reducción 50%', `${severity.reduction}€`, 'Art. 94.1');
  drawSanctionCard(125, 'Detrac. Puntos', `${severity.points}`, 'Carnet');

  doc.setFillColor(252, 243, 243);
  doc.setDrawColor(186, 42, 42);
  doc.rect(19, y + 22, 162, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(120, 30, 30);
  doc.text('PLAZO: 20 días naturales para pago con reducción del 50% desde el día siguiente a notificación. Art. 94.4: No aplica a infracciones muy graves.', 21, y + 26.2, { maxWidth: 160 });
  doc.setTextColor(0, 0, 0);

  y += 33;
  y = drawSectionTitle(doc, '06', 'Autoridad Actuante', y);

  drawFieldLine(doc, 16, y + 2, 88, 'N.I.P. del Agente Denunciante', 'SENT-AI-01');
  drawFieldLine(doc, 108, y + 2, 84, 'Unidad / Sección', 'Policía Local de Daganzo de Arriba');

  doc.rect(16, y + 18, 88, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(70, 70, 70);
  doc.text('FIRMA DEL AGENTE DENUNCIANTE', 60, y + 21.5, { align: 'center' });
  drawLine(doc, 20, y + 26, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('Policía Local de Daganzo de Arriba', 60, y + 29, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y += 35;
  y = drawSectionTitle(doc, '07', 'Registro Fotográfico de la Infracción', y, 'Art. 23.3 TRLTSV - Imágenes como prueba');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(53, 93, 139);
  doc.text('IMÁGENES GENERALES - CONTEXTO', 16, y + 3);
  doc.text('IMÁGENES DE DETALLE - MATRÍCULA', 107, y + 3);
  doc.setTextColor(0, 0, 0);

  const contextImages = (log.extraSnapshots || []).slice(0, 3).map(withImagePrefix);
  const detailImages = [withImagePrefix(log.image), ...(log.zoomSnapshots || []).slice(0, 2).map(withImagePrefix)];
  const rowYs = [y + 7, y + 90];
  const boxH = 80;

  rowYs.forEach((rowY, idx) => {
    const captionContext = idx === 0 ? undefined : (idx === 1 && log.videoTimeCode ? `Hora ${log.videoTimeCode}` : undefined);
    const captionDetail = idx === 0 && log.plate ? `Matrícula: ${log.plate}` : (log.ocrResults?.[idx] ? `OCR: ${log.ocrResults[idx]}` : undefined);

    drawLabeledImage(doc, contextImages[idx] || null, 12, rowY, 90, boxH, `CONTEXTO 0${idx + 1}`, captionContext);
    drawLabeledImage(doc, detailImages[idx] || null, 107, rowY, 90, boxH, `DETALLE 0${idx + 1}`, captionDetail);
  });

  // ===== PAGE 3: CITIZEN INFORMATION =====
  doc.addPage();
  await drawHeader(doc, 3, totalPages);

  y = 32;
  y = drawSectionTitle(doc, '08', 'Plazo para Actuar — 20 Días Naturales desde Notificación', y, 'Art. 94 TRLTSV · Art. 79.1 Ley 39/2015');

  drawParagraphBox(doc, 16, y + 1, 88, 35, 'OPCIÓN A — PAGO CON REDUCCIÓN 50%',
    `• Pago voluntario en 20 días produce:\n• Reducción del 50% de sanción\n• Renuncia a formular alegaciones\n• Terminación sin resolución expresa\n\nATENCIÓN: No aplica a infracciones muy graves ni saldo < 8 puntos (Art. 94.4 TRLTSV).`);

  drawParagraphBox(doc, 107, y + 1, 85, 35, 'OPCIÓN B — FORMULAR ALEGACIONES',
    `• Dispone 20 días para presentar alegaciones y pruebas\n• Dirigidas al órgano instructor\n• Debe incluir: expediente, DNI, domicilio, fundamentos\n\n(Art. 22 RD 320/1994)`);

  y += 40;
  y = drawSectionTitle(doc, '09', 'Formas de Pago', y);

  drawParagraphBox(doc, 16, y + 1, 56, 20, 'PAGO ONLINE',
    'www.ayto-daganzo.org → Sede Electrónica → Pago Multas. Nº expediente completo.');

  drawParagraphBox(doc, 74, y + 1, 56, 20, 'PAGO PRESENCIAL',
    'Plaza de la Villa 1, 28814 Daganzo. Tel. 91 884 52 59. L-V 08:00-15:00');

  drawParagraphBox(doc, 132, y + 1, 70, 20, 'TRANSFERENCIA BANCARIA',
    'IBAN: ES12 3456 7890 1234 5678 9012. Concepto: expediente completo.');

  y += 25;
  drawParagraphBox(doc, 16, y, 88, 18, '10. TRAMITACIÓN',
    'Conforme RD 320/1994 y Ley 39/2015. Órgano instructor realizará actuaciones necesarias. Plazo máximo resolver: 1 año.');

  drawParagraphBox(doc, 107, y, 85, 18, '11. RECURSOS',
    '• Recurso reposición: 1 mes desde notificación\n• Recurso contencioso: 2 meses desde notificación');

  // ===== PAGE 4: PRESCRIPTION & ENFORCEMENT =====
  doc.addPage();
  await drawHeader(doc, 4, totalPages);

  y = 32;
  y = drawSectionTitle(doc, '12', 'Plazos de Prescripción (Art. 92 TRLTSV)', y);

  // Prescription table
  doc.setDrawColor(192, 202, 216);
  doc.setLineWidth(0.25);
  doc.rect(16, y, 178, 28);
  doc.setFillColor(33, 65, 105);
  doc.rect(16, y, 178, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(255, 255, 255);
  doc.text('Tipo de Infracción', 19, y + 4);
  doc.text('Prescripción Infracción', 70, y + 4);
  doc.text('Prescripción Sanción', 125, y + 4);
  doc.text('Base Legal', 165, y + 4);

  const rows = [
    ['Infracciones Leves', '3 meses', '1 año', 'Art. 92'],
    ['Infracciones Graves', '6 meses', '2 años', 'Art. 92'],
    ['Infracciones Muy Graves', '1 año', '4 años', 'Art. 92'],
    ['Sanciones Firmes', '—', '4 años', 'Art. 92.2'],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  let tableY = y + 9;
  rows.forEach((row) => {
    doc.setTextColor(50, 50, 50);
    doc.text(row[0], 19, tableY);
    doc.text(row[1], 70, tableY);
    doc.text(row[2], 125, tableY);
    doc.text(row[3], 165, tableY);
    drawLine(doc, 18, tableY + 1.8, 174, [228, 232, 238]);
    tableY += 5.5;
  });
  doc.setTextColor(0, 0, 0);

  y += 35;
  drawParagraphBox(doc, 16, y, 88, 22, '13. EJECUCIÓN FORZOSA',
    '• Recargo apremio: 20% + intereses\n• Embargo de bienes\n• Anotación ficheros de morosos\n• Comunicación a DGT');

  drawParagraphBox(doc, 107, y, 85, 22, '14. INHABILITACIÓN PERMISO',
    'Conforme arts. 68-71 TRLTSV. Suspensión/privación permiso como sanción accesoria independiente.');

  // ===== PAGE 5: DATA PROTECTION =====
  doc.addPage();
  await drawHeader(doc, 5, totalPages);

  y = 32;
  y = drawSectionTitle(doc, '17', 'Información Protección de Datos Personales', y, 'RGPD (UE 2016/679) · LOPDGDD (LO 3/2018) · LO 7/2021');

  drawParagraphBox(doc, 16, y + 1, 88, 30, 'RESPONSABLE TRATAMIENTO',
    'Ayuntamiento Daganzo Arriba · Plaza de la Villa 1 · 28814 Daganzo · Policía Local: Glorieta de Alcalá s/n · Tel. 91 887 59 19 · policia@ayto-daganzo.org');

  drawParagraphBox(doc, 107, y + 1, 85, 30, 'FINALIDADES DATOS',
    '• Gestión procedimiento sancionador\n• Control del tráfico\n• Prevención infracciones\n• Cobro ejecutivo\n• Destinatarios: DGT, órganos judiciales, administraciones');

  y += 35;
  drawParagraphBox(doc, 16, y, 178, 15, 'AUTORIDAD CONTROL - AEPD',
    'Calle Jorge Juan 6, 28001 Madrid - www.aepd.es · Derechos: Acceso, rectificación, supresión, limitación, oposición (conforme RGPD y LOPDGDD)');

  y += 20;
  drawParagraphBox(doc, 16, y, 178, 12, 'V. VALIDACIÓN JURÍDICA',
    'El presente boletín se ajusta a normativa vigente en materia de tráfico (RDL 6/2015), procedimiento sancionador (RD 320/1994; Ley 39/2015) y protección de datos (RGPD; LOPDGDD; LO 7/2021).');

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(53, 93, 139);
  doc.text('DAGANZO DE ARRIBA, A', 16, y);
  doc.text('DE', 77, y);
  doc.text('DE', 92, y);
  drawLine(doc, 16, y + 4.5, 58);
  drawLine(doc, 77, y + 4.5, 12);
  drawLine(doc, 92, y + 4.5, 12);

  doc.setDrawColor(192, 202, 216);
  doc.rect(108, y - 5, 42, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(70, 70, 70);
  doc.text('FIRMA INSTRUCTOR', 129, y, { align: 'center' });
  drawLine(doc, 113, y + 3.4, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('Policía Local Daganzo', 129, y + 6, { align: 'center' });

  doc.setDrawColor(210, 210, 210);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(174, y - 7, 20, 14);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('SELLO\nOFICIAL', 184, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
};

const bufferToBlob = (buffer: ArrayBuffer): Blob => new Blob([buffer], { type: 'application/pdf' });

// ===== EXPORTED SERVICE =====

export const ReportService = {
  async exportToCsv(infractions: InfractionLog[], filename = 'Sentinel_Report_Batch.csv') {
    if (infractions.length === 0) return;

    const rows = infractions.map((inf) => ({
      ID: inf.id,
      'Fecha Local': inf.localTime || inf.time,
      'Tiempo Video (OSD)': inf.videoTimeCode || '',
      'Marca/Modelo': inf.makeModel,
      'Placa/Matrícula': inf.plate,
      'OCR Matrícula': inf.plateOcr || '',
      Color: inf.color,
      Categoría: inf.ruleCategory,
      Gravedad: inf.severity,
      Descripción: inf.description,
      'Base Legal': inf.legalBase,
      'Timestamp Visual': inf.visualTimestamp,
      'Velocidad Estimada': inf.telemetry?.speedEstimated,
      Anomalías: inf.telemetry?.behaviorAnomalies || '',
      Validación: inf.validationStatus || '',
    }));

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvCell(row[header as keyof typeof row])).join(',')
      ),
    ];

    const blob = new Blob([`\uFEFF${csvLines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  async generateInfractionPdf(log: InfractionLog, filename?: string): Promise<ArrayBuffer> {
    const doc = await createDoc();
    const exp = getExpedienteNumber();
    await buildInfractionPages(doc, log, filename || `Expediente_${log.id}_${log.plate || 'SENT'}.pdf`, exp);
    return doc.output('arraybuffer');
  },

  async downloadInfractionPdf(log: InfractionLog, filename?: string): Promise<void> {
    const expNum = getExpedienteNumber().replace(/\//g, '_');
    const file = filename || `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
    const buffer = await this.generateInfractionPdf(log, file);
    const url = URL.createObjectURL(bufferToBlob(buffer));
    const link = document.createElement('a');
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
  },

  async generateAndSaveInfractionPdf(log: InfractionLog): Promise<{ filename: string; path: string }> {
    const expNum = getExpedienteNumber().replace(/\//g, '_');
    const filename = `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
    const buffer = await this.generateInfractionPdf(log, filename);

    let dateStr: string | undefined;
    if (log.localTime) {
      const match = log.localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }

    const path = await this.savePdfToDisk(buffer, filename, dateStr);
    return { filename, path };
  },

  async generateBatchPdf(infractions: InfractionLog[]): Promise<{ buffer: ArrayBuffer; filename: string }> {
    const doc = await createDoc();
    const filename = `Sentinel_Denuncias_${formatTimestamp()}.pdf`;

    for (let i = 0; i < infractions.length; i++) {
      if (i > 0) doc.addPage();
      await buildInfractionPages(doc, infractions[i], filename, getExpedienteNumber());
    }

    return { buffer: doc.output('arraybuffer'), filename };
  },

  async savePdfToDisk(buffer: ArrayBuffer, filename: string, dateStr?: string): Promise<string> {
    const query = new URLSearchParams({ filename });
    if (dateStr) query.append('date', dateStr);
    const saveUrl = getApiUrl(`/api/reports/save?${query.toString()}`);
    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: buffer,
    });
    if (!response.ok) throw new Error('No se pudo guardar el PDF en el servidor');
    const data = await response.json();
    return data.path as string;
  },

  async saveVideoToDisk(buffer: ArrayBuffer, filename: string, dateStr?: string): Promise<string> {
    const query = new URLSearchParams({ filename });
    if (dateStr) query.append('date', dateStr);
    const videoUrl = getApiUrl(`/api/reports/video?${query.toString()}`);
    const response = await fetch(videoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
    });
    if (!response.ok) throw new Error('No se pudo guardar el Video en el servidor');
    const data = await response.json();
    return data.path as string;
  },

  async generateAndSaveBatchPdf(infractions: InfractionLog[]): Promise<{ filename: string; path: string }> {
    const { buffer, filename } = await this.generateBatchPdf(infractions);

    let dateStr: string | undefined;
    if (infractions.length > 0 && infractions[0].localTime) {
      const match = infractions[0].localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) dateStr = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }

    const path = await this.savePdfToDisk(buffer, filename, dateStr);
    return { filename, path };
  },
};
