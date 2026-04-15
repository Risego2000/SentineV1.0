import { InfractionLog } from '../types';

type JsPDFType = typeof import('jspdf').jsPDF;

const escapeCsvCell = (value: unknown): string => {
  const normalized = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

const formatTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

const getExpedienteNumber = (infractionDate?: Date): string => {
  const date = infractionDate || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `sentinel_exp_${year}_${month}_${day}`;
  const current = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(current));
  return `${year}/${month}/${day}/${String(current).padStart(3, '0')}`;
};

const getExpedienteFolder = (infractionDate: Date): string => {
  const year = infractionDate.getFullYear();
  const month = String(infractionDate.getMonth() + 1).padStart(2, '0');
  const day = String(infractionDate.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
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

type RGB = [number, number, number];

const BRAND: Record<string, RGB> = {
  red: [135, 12, 16],
  gold: [194, 133, 53],
  goldLight: [208, 167, 118],
  parchment: [235, 215, 186],
  cream: [230, 221, 205],
  sand: [219, 190, 157],
  grayStone: [180, 179, 170],
  grayBlue: [141, 149, 145],
  white: [255, 255, 255],
  black: [0, 0, 0],
};

const addAnverso = async (doc: InstanceType<JsPDFType>, log: InfractionLog, exp: string) => {
  const logo = await getLogo();
  const escudo = await getEscudo();

  // Fondo pergamino
  doc.setFillColor(...BRAND.parchment);
  doc.rect(10, 10, 190, 277, 'F');

  // Borde exterior rojo institucional
  doc.setDrawColor(...BRAND.red);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);

  // Línea dorada decorativa superior
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(2);
  doc.line(10, 32, 200, 32);

  // Header con logo
  if (escudo) doc.addImage(escudo, 'PNG', 14, 14, 16, 16);
  if (logo) doc.addImage(logo, 'PNG', 168, 13, 28, 17);

  // Título principal en rojo institucional
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BOLETÍN DE DENUNCIA EN MATERIA DE TRÁFICO', 105, 22, { align: 'center' });

  // Subtítulo
  doc.setTextColor(...BRAND.grayStone);
  doc.setFontSize(9);
  doc.text('Excmo. Ayuntamiento de Daganzo de Arriba - Policía Local', 105, 29, {
    align: 'center',
  });

  let y = 40;

  // Función helper para secciones
  const addSectionHeader = (title: string) => {
    doc.setFillColor(...BRAND.red);
    doc.rect(10, y - 3, 190, 6, 'F');
    doc.setTextColor(...BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, 14, y);
    y += 8;
  };

  const addField = (label: string, value: string, x = 12) => {
    doc.setTextColor(...BRAND.grayStone);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, x, y);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(value, x + 45, y);
  };

  // DATOS DE LA DENUNCIA
  addSectionHeader('DATOS DE LA DENUNCIA');

  const [date, time] = (log.localTime || log.time).split(' ');
  addField('Número de Expediente:', exp);
  y += 5;
  addField('Fecha:', `${date || '__/__/____'}`);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Hora:', 100, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(time || '__:__', 115, y);
  y += 5;
  addField('Lugar:', log.infractionLocation || 'Casco Urbano / Vía Pública - Daganzo de Arriba');
  y += 3;
  addField('Término Municipal:', 'Daganzo de Arriba (Madrid)');
  y += 10;

  // DATOS DEL VEHÍCULO
  addSectionHeader('DATOS DEL VEHÍCULO');

  addField('Matrícula:', log.plate || 'N/D');
  addField('Marca / Modelo:', log.makeModel || 'N/D', 100);
  y += 5;
  addField('Color:', log.color || 'N/D');
  addField('Tipo de Vehículo:', 'Turismo', 100);
  y += 10;

  // HECHO QUE SE DENUNCIA
  addSectionHeader('HECHO QUE SE DENUNCIA Y PRECEPTO VULNERADO');

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('HECHO DENUNCIADO:', 12, y);
  y += 5;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const lineHeight = 4;
  const hechoText = `El vehículo anteriormente identificado ha sido detectado realizando ${log.ruleCategory.toLowerCase()} en el lugar, fecha y hora indicados.

Los hechos han sido captados mediante sistemas de captación y reproducción de imágenes destinados al control del tráfico, debidamente autorizados, conforme a lo dispuesto en el artículo 23 del Real Decreto Legislativo 6/2015, de 30 de octubre, por el que se aprueba el Texto Refundido de la Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial.

Asimismo, el tratamiento de las imágenes se realiza conforme a la normativa vigente en materia de protección de datos personales aplicable a fines policiales y sancionadores.

Las imágenes obtenidas se incorporan al expediente sancionador como medio de prueba válido y quedan a disposición del interesado en los términos legalmente previstos.`;

  const hechoLines = doc.splitTextToSize(hechoText, 183);
  doc.text(hechoLines, 12, y);
  y += hechoLines.length * lineHeight + 6;

  // Estimates for fine
  let amount = 200;
  let points = 0;
  let severity = 'GRAVE';
  const sev = log.severity as string;

  if (sev === 'LOW') {
    amount = 100;
    points = 0;
    severity = 'LEVE';
  } else if (sev === 'MEDIUM') {
    amount = 200;
    points = 2;
    severity = 'GRAVE';
  } else if (sev === 'HIGH') {
    amount = 300;
    points = 4;
    severity = 'GRAVE';
  } else if (sev === 'CRITICAL') {
    amount = 500;
    points = 6;
    severity = 'MUY GRAVE';
  }

  // Línea dorada separadora
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.5);
  doc.line(12, y, 198, y);
  y += 5;

  addField('PRECEPTO INFRINGIDO:', log.legalBase || 'Art. TRLTSV');
  y += 5;
  addField('TIPIFICACIÓN / GRAVEDAD:', severity);
  y += 6;

  // Box de cuantificación con fondo crema
  doc.setFillColor(...BRAND.cream);
  doc.roundedRect(12, y - 2, 186, 22, 2, 2, 'F');

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`CUANTÍA DE LA SANCIÓN: ${amount} €`, 16, y + 5);

  doc.setTextColor(...BRAND.gold);
  doc.setFontSize(9);
  doc.text(`REDUCCIÓN 50% (art. 94 TRLTSV): ${amount / 2} €`, 100, y + 5);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.text(`PUNTOS: ${points}`, 100, y + 14);
  y += 28;

  // REGISTRO FOTOGRÁFICO
  const contextImages = (log.extraSnapshots || [])
    .slice(0, 3)
    .map(withImagePrefix)
    .filter(Boolean) as string[];
  const zoomImages = (log.zoomSnapshots || [])
    .slice(0, 3)
    .map(withImagePrefix)
    .filter(Boolean) as string[];

  if (contextImages.length > 0 || zoomImages.length > 0) {
    addSectionHeader('REGISTRO FOTOGRÁFICO DE LA INFRACCIÓN');

    const imgW = 58;
    const imgH = 32;
    const gap = 6;

    if (contextImages.length > 0) {
      doc.setTextColor(...BRAND.gold);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('IMÁGENES GENERALES (Contexto de los hechos):', 12, y);
      y += 4;

      contextImages.forEach((img, idx) => {
        doc.addImage(img, 'JPEG', 12 + idx * (imgW + gap), y, imgW, imgH);
        doc.setDrawColor(...BRAND.gold);
        doc.setLineWidth(0.3);
        doc.rect(12 + idx * (imgW + gap), y, imgW, imgH);
      });
      y += imgH + 6;
    }

    if (zoomImages.length > 0) {
      doc.setTextColor(...BRAND.gold);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('IMÁGENES DE DETALLE (Elemento probatorio):', 12, y);
      y += 4;

      zoomImages.forEach((img, idx) => {
        doc.addImage(img, 'JPEG', 12 + idx * (imgW + gap), y, imgW, imgH);
        doc.setDrawColor(...BRAND.red);
        doc.setLineWidth(0.5);
        doc.rect(12 + idx * (imgW + gap), y, imgW, imgH);
      });
      y += imgH + 6;
    }
  }

  // FIRMAS
  addSectionHeader('FIRMAS');

  doc.setTextColor(...BRAND.grayStone);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Firma del Agente Denunciante', 12, y);
  doc.text('Sello', 105, y);
  y += 18;

  doc.setDrawColor(...BRAND.grayStone);
  doc.setLineWidth(0.3);
  doc.line(12, y, 90, y);
  doc.line(105, y, 183, y);
  y += 5;

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Agente TIP: SENT-AI-01', 12, y);
  y += 4;
  doc.setTextColor(...BRAND.grayStone);
  doc.setFont('helvetica', 'normal');
  doc.text('Policía Local de Daganzo de Arriba', 12, y);
  y += 10;

  // NOTA LEGAL con borde izquierdo dorado
  doc.setFillColor(...BRAND.sand);
  doc.roundedRect(10, y - 3, 190, 18, 2, 2, 'F');
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(2);
  doc.line(10, y - 3, 10, y + 15);

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('NOTA LEGAL:', 14, y + 2);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  const noteText = `En los supuestos de denuncia formulada mediante sistemas automáticos de captación de imágenes en los que el denunciado no se encuentre presente, la notificación se practicará con posterioridad, conforme al art. 90 del TRLTSV y los arts. 40 y sig. de la Ley 39/2015.`;
  const noteLines = doc.splitTextToSize(noteText, 180);
  doc.text(noteLines, 14, y + 7);
};

const addInformacionReverso = (doc: InstanceType<JsPDFType>, exp: string) => {
  doc.addPage();

  // Fondo pergamino
  doc.setFillColor(...BRAND.parchment);
  doc.rect(10, 10, 190, 277, 'F');

  // Borde exterior rojo institucional
  doc.setDrawColor(...BRAND.red);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);

  // Línea dorada decorativa superior
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(2);
  doc.line(10, 22, 200, 22);

  // Título con fondo rojo
  doc.setFillColor(...BRAND.red);
  doc.rect(10, 10, 190, 12, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INFORMACIÓN SOBRE EL PROCEDIMIENTO SANCIONADOR Y DERECHOS DEL INTERESADO', 105, 18, {
    align: 'center',
  });

  let y = 30;

  // Helper para secciones
  const addSectionHeader = (title: string, num?: string) => {
    const prefix = num ? `${num}. ` : '';
    doc.setFillColor(...BRAND.cream);
    doc.roundedRect(10, y - 3, 190, 6, 1, 1, 'F');
    doc.setTextColor(...BRAND.red);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${prefix}${title}`, 14, y);
    y += 8;
  };

  // Introducción
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const introText = `De conformidad con lo dispuesto en la normativa vigente en materia de tráfico y procedimiento sancionador, se le informa de que dispone de un plazo de veinte (20) días naturales, contados a partir del día siguiente al de la notificación de la presente denuncia, para optar por alguna de las siguientes actuaciones:`;
  const introLines = doc.splitTextToSize(introText, 183);
  doc.text(introLines, 12, y);
  y += introLines.length * 3.5 + 6;

  // 1. PAGO VOLUNTARIO
  addSectionHeader('PAGO VOLUNTARIO CON REDUCCIÓN DEL 50%', '1');

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const pagoText = `Podrá efectuar el pago de la sanción dentro del plazo indicado, beneficiándose de una reducción del 50% sobre el importe de la multa, conforme a lo establecido en los artículos aplicables del texto refundido de la Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial.`;
  const pagoLines = doc.splitTextToSize(pagoText, 183);
  doc.text(pagoLines, 12, y);
  y += pagoLines.length * 3.5 + 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('El pago voluntario con reducción implicará:', 12, y);
  y += 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    '• La renuncia expresa a formular alegaciones o a interponer recurso administrativo.',
    15,
    y
  );
  y += 3;
  doc.text(
    '• La terminación del procedimiento sancionador, sin necesidad de resolución expresa.',
    15,
    y
  );
  y += 3;
  doc.text('• La firmeza de la sanción en vía administrativa desde el momento del pago.', 15, y);
  y += 8;

  // 2. ALEGACIONES
  addSectionHeader('FORMULACIÓN DE ALEGACIONES Y PROPUESTA DE PRUEBAS', '2');

  const aleText = `En caso de no estar conforme con los hechos denunciados, podrá presentar escrito de alegaciones y, en su caso, proponer o aportar las pruebas que estime oportunas en defensa de sus derechos, dentro del mismo plazo de 20 días naturales.`;
  const aleLines = doc.splitTextToSize(aleText, 183);
  doc.text(aleLines, 12, y);
  y += aleLines.length * 3.5 + 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    'Las alegaciones deberán dirigirse a la autoridad instructora competente, indicando claramente:',
    12,
    y
  );
  y += 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('• Número de expediente.', 15, y);
  y += 3;
  doc.text('• Datos identificativos del interesado.', 15, y);
  y += 3;
  doc.text('• Exposición de los hechos y fundamentos que se aleguen.', 15, y);
  y += 8;

  // FORMAS DE PAGO
  addSectionHeader('FORMAS Y PROCEDIMIENTO DE PAGO');

  // Box dorado para cuenta
  doc.setFillColor(...BRAND.cream);
  doc.roundedRect(12, y - 2, 183, 22, 2, 2, 'F');
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(1);
  doc.roundedRect(12, y - 2, 183, 22, 2, 2, 'S');

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CUENTA BANCARIA PARA TRANSFERENCIA:', 16, y + 5);
  y += 2;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ES12 3456 7890 1234 5678 9012', 16, y + 12);
  y += 6;

  doc.setTextColor(...BRAND.grayStone);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONCEPTO:', 16, y + 10);
  doc.setTextColor(...BRAND.red);
  doc.text(`Expediente nº ${exp}`, 50, y + 10);
  y += 18;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MODALIDADES DE PAGO:', 12, y);
  y += 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('• Online:', 15, y);
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.text('www.ayto-daganzo.org', 35, y);
  y += 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '• Presencial (Caja Municipal): Plaza de la Villa, nº 1, 28814 Daganzo de Arriba (L-V 09:00-14:00)',
    15,
    y
  );
  y += 3;
  doc.text(
    '• Transferencia bancaria: A la cuenta indicada, consignando el número de expediente.',
    15,
    y
  );
  y += 8;

  // 3. RECURSOS
  addSectionHeader('PLAZOS, RECURSOS Y VÍAS DE IMPUGNACIÓN', '3');

  const procText = `En caso de no acogerse al pago con reducción y formular alegaciones, se seguirá el procedimiento sancionador conforme a lo previsto en el Reglamento del procedimiento sancionador en materia de tráfico (Real Decreto 320/1994).`;
  const procLines = doc.splitTextToSize(procText, 183);
  doc.text(procLines, 12, y);
  y += procLines.length * 3.5 + 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Contra la resolución que ponga fin al procedimiento, podrá interponer:', 12, y);
  y += 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('• Recurso de alzada:', 15, y);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.text(
    'En el plazo de un (1) mes, ante el Ilmo. Sr. Comandante del/acalcalde de Daganzo de Arriba.',
    18,
    y
  );
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('• Recurso contencioso-administrativo:', 15, y);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Ante el Juzgado de lo Contencioso-Administrativo de Madrid, en el plazo legalmente establecido.',
    18,
    y
  );
  y += 8;

  // PRESCRIPCIÓN
  addSectionHeader('PRESCRIPCIÓN DE INFRACCIONES Y SANCIONES');

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Infracciones:', 12, y);
  y += 4;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '• Leves: prescriben a los 3 meses    • Graves: prescriben a los 6 meses    • Muy graves: prescriben al 1 año',
    15,
    y
  );
  y += 4;
  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Sanciones:', 12, y);
  y += 4;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Prescriben al año, una vez sean firmes en vía administrativa.', 15, y);
  y += 8;

  // EJECUCIÓN FORZOSA
  addSectionHeader('EJECUCIÓN Y VÍA DE APREMIO');

  const execText = `En caso de no efectuarse el pago de la sanción una vez que esta sea firme en vía administrativa, se procederá a su exacción por la vía ejecutiva, conforme a lo establecido en la normativa tributaria y de recaudación.`;
  const execLines = doc.splitTextToSize(execText, 183);
  doc.text(execLines, 12, y);
  y += execLines.length * 3.5 + 4;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('• La aplicación de los recargos legales correspondientes.', 15, y);
  y += 3;
  doc.text(
    '• La posibilidad de adopción de medidas de ejecución forzosa, incluyendo el embargo de bienes y derechos del deudor.',
    15,
    y
  );
  y += 8;

  // PROTECCIÓN DE DATOS
  addSectionHeader('PROTECCIÓN DE DATOS PERSONALES');

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Responsable:', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Ayuntamiento de Daganzo de Arriba - CIF: P-1005000-C - Plaza de la Villa, 1, 28814 Daganzo de Arriba',
    15,
    y
  );
  y += 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Delegado de Protección de Datos (DPO):', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('dpd@ayto-daganzo.org', 15, y);
  y += 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Finalidad:', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Tramitación del procedimiento sancionador, prevención de infracciones, ejercicio de potestad sancionadora.',
    15,
    y
  );
  y += 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Base jurídica:', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('R.D.L. 6/2015, Ley 39/2015, L.O. 7/2021, RGPD (UE) 2016/679, L.O. 3/2018.', 15, y);
  y += 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Derechos ARCO+:', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Acceso, Rectificación, Supresión, Limitación, Oposición, Portabilidad.', 15, y);
  y += 4;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.text('Autoridad de control:', 12, y);
  y += 3;
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Agencia Española de Protección de Datos (AEPD) - www.aepd.es', 15, y);

  // Footer
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.5);
  doc.line(10, 282, 200, 282);
  doc.setTextColor(...BRAND.grayStone);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('AYUNTAMIENTO DE DAGANZO DE ARRIBA - POLICÍA LOCAL', 105, 287, { align: 'center' });
};

const buildInfractionPages = async (
  doc: InstanceType<JsPDFType>,
  log: InfractionLog,
  index: number,
  total: number
) => {
  const infractionDate = log.localTime ? parseInfractionDate(log.localTime) : new Date();
  const exp = getExpedienteNumber(infractionDate);
  await addAnverso(doc, log, exp);
  addInformacionReverso(doc, exp);
};

const parseInfractionDate = (localTime: string): Date => {
  const match = localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  return new Date();
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
    const infractionDate = log.localTime ? parseInfractionDate(log.localTime) : new Date();
    const expNum = getExpedienteNumber(infractionDate).replace(/\//g, '_');
    const file = filename || `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
    const buffer = await this.generateInfractionPdf(log);
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
    const infractionDate = log.localTime ? parseInfractionDate(log.localTime) : new Date();
    const expNum = getExpedienteNumber(infractionDate).replace(/\//g, '_');
    const filename = `Expediente_${expNum}_${log.plate || 'SENT'}.pdf`;
    const buffer = await this.generateInfractionPdf(log);
    const folderDate = getExpedienteFolder(infractionDate);
    const path = await this.savePdfToDisk(buffer, filename, folderDate);
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
