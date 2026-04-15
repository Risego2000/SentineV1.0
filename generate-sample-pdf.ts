import { jsPDF } from 'jspdf';
import { writeFile } from 'fs/promises';

type RGB = [number, number, number];

const BRAND: Record<string, RGB> = {
  red: [135, 12, 16],
  gold: [194, 133, 53],
  parchment: [235, 215, 186],
  cream: [230, 221, 205],
  sand: [219, 190, 157],
  grayStone: [180, 179, 170],
  white: [255, 255, 255],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 15;
const MARGIN_R = 195;
const CONTENT_W = MARGIN_R - MARGIN_L;

const generateSamplePdf = async () => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 0;

  // ==================== FUNCIONES HELPER ====================
  const setTitle = (text: string, size = 16, color = BRAND.red) => {
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, PAGE_W / 2, y, { align: 'center' });
    y += size * 0.5;
  };

  const setSectionHeader = (text: string) => {
    y += 3;
    doc.setFillColor(...BRAND.cream);
    doc.rect(MARGIN_L, y, CONTENT_W, 6, 'F');
    doc.setTextColor(...BRAND.red);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(text, MARGIN_L + 3, y + 4.5);
    y += 10;
  };

  const setSubSection = (text: string) => {
    doc.setTextColor(...BRAND.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(text, MARGIN_L, y);
    y += 6;
  };

  const addParagraph = (text: string, indent = 0) => {
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    lines.forEach((line: string) => {
      doc.text(line, MARGIN_L + indent, y);
      y += 4.5;
    });
    y += 2;
  };

  const addBulletPoint = (text: string, bullet = '•') => {
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(bullet, MARGIN_L, y);
    const lines = doc.splitTextToSize(text, CONTENT_W - 5);
    doc.text(lines[0], MARGIN_L + 5, y);
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        y += 4;
        doc.text(lines[i], MARGIN_L + 5, y);
      }
    }
    y += 5;
  };

  const addField = (label: string, line = true) => {
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(label, MARGIN_L, y);
    if (line) {
      const labelWidth = doc.getTextWidth(label);
      doc.setDrawColor(...BRAND.grayStone);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_L + labelWidth + 2, y + 1, MARGIN_R, y + 1);
    }
    y += 6;
  };

  const addFieldInline = (label1: string, label2: string) => {
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const w1 = doc.getTextWidth(label1);
    doc.text(label1, MARGIN_L, y);
    doc.setDrawColor(...BRAND.grayStone);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L + w1 + 1, y + 1, 95, y + 1);
    doc.text(label2, 100, y);
    const w2 = doc.getTextWidth(label2);
    doc.line(100 + w2 + 1, y + 1, MARGIN_R, y + 1);
    y += 6;
  };

  const addCheckbox = (text: string, checked = false) => {
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (checked) {
      doc.setFillColor(...BRAND.red);
      doc.rect(MARGIN_L, y - 3, 3, 3, 'F');
    } else {
      doc.setDrawColor(...BRAND.grayStone);
      doc.rect(MARGIN_L, y - 3, 3, 3, 'S');
    }
    doc.text(text, MARGIN_L + 5, y);
    y += 6;
  };

  const addHorizontalLine = () => {
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_L, y, MARGIN_R, y);
    y += 5;
  };

  const checkPageBreak = (needed = 30) => {
    if (y + needed > PAGE_H - 25) {
      doc.addPage();
      initPage();
    }
  };

  const initPage = () => {
    y = 15;
    doc.setFillColor(...BRAND.parchment);
    doc.rect(MARGIN_L - 5, 10, CONTENT_W + 10, 277, 'F');
    doc.setDrawColor(...BRAND.red);
    doc.setLineWidth(1);
    doc.rect(MARGIN_L - 5, 10, CONTENT_W + 10, 277);
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(1.5);
    doc.line(MARGIN_L - 5, 28, MARGIN_R + 5, 28);
  };

  // ==================== ANVERSO ====================
  initPage();

  // Título principal
  setTitle('BOLETÍN DE DENUNCIA EN MATERIA DE TRÁFICO', 14);
  setTitle('Excmo. Ayuntamiento de Daganzo de Arriba (Madrid)', 10, BRAND.grayStone);
  setTitle('Policía Local', 9, BRAND.gold);
  y += 3;

  addHorizontalLine();

  // DATOS DE LA DENUNCIA
  setSectionHeader('DATOS DE LA DENUNCIA');
  addField('Número de Expediente:');
  addFieldInline('Fecha: ....../......../..........', 'Hora: ......:......');
  addField('Lugar de la Infracción:');
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Término municipal:', MARGIN_L, y);
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.text('Daganzo de Arriba (Madrid)', MARGIN_L + 50, y);
  y += 10;

  // DATOS DEL VEHÍCULO
  setSectionHeader('DATOS DEL VEHÍCULO');
  addFieldInline('Matrícula:', 'Marca / Modelo:');
  addFieldInline('Color:', 'Tipo de Vehículo:');
  y += 5;

  // HECHO QUE SE DENUNCIA
  setSectionHeader('HECHO QUE SE DENUNCIA Y PRECEPTO VULNERADO');
  setSubSection('HECHO DENUNCIADO');
  addParagraph(
    'El vehículo anteriormente identificado ha sido detectado realizando la siguiente conducta constitutiva de infracción administrativa en materia de tráfico:'
  );
  y += 2;

  // Campo de texto grande
  doc.setDrawColor(...BRAND.grayStone);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 3; i++) {
    doc.line(MARGIN_L, y, MARGIN_R, y);
    y += 6;
  }
  y += 2;
  addParagraph('en el lugar, fecha y hora indicados.');
  addParagraph(
    'Los hechos han sido constatados por agentes de la autoridad y/o captados mediante sistemas automáticos de captación y reproducción de imágenes destinados al control del tráfico, debidamente autorizados, conforme a lo dispuesto en el artículo 23 del Real Decreto Legislativo 6/2015.'
  );
  addParagraph(
    'Las imágenes obtenidas se incorporan al expediente sancionador como medio de prueba válido, quedando a disposición del interesado en los términos legalmente previstos.'
  );

  setSubSection('PRECEPTO INFRINGIDO');
  doc.setDrawColor(...BRAND.grayStone);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L, y, MARGIN_R, y);
  y += 10;

  setSubSection('TIPIFICACIÓN / GRAVEDAD');
  addCheckbox('Leve');
  addCheckbox('Grave');
  addCheckbox('Muy grave');
  y += 3;

  setSubSection('SANCIÓN PROPUESTA');
  addFieldInline('Importe:', ' €');
  addFieldInline('Reducción 50% (art. 94 TRLTSV):', ' €');
  addFieldInline('Pérdida de puntos (en su caso):', '');
  y += 5;

  // REGISTRO FOTOGRÁFICO
  checkPageBreak(80);
  setSectionHeader('REGISTRO FOTOGRÁFICO DE LA INFRACCIÓN');
  setSubSection('IMÁGENES GENERALES (Contexto)');

  const imgW = 52;
  const imgH = 28;
  const imgGap = 8;
  const imgStartX = MARGIN_L + (CONTENT_W - (imgW * 3 + imgGap * 2)) / 2;

  for (let i = 0; i < 3; i++) {
    const x = imgStartX + i * (imgW + imgGap);
    doc.setFillColor(245, 240, 230);
    doc.rect(x, y, imgW, imgH, 'F');
    doc.setDrawColor(...BRAND.gold);
    doc.rect(x, y, imgW, imgH);
    doc.setTextColor(...BRAND.grayStone);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text(`[ IMAGEN ${i + 1} ]`, x + imgW / 2, y + imgH / 2, { align: 'center' });
  }
  y += imgH + 8;

  setSubSection('IMÁGENES DE DETALLE (Prueba)');
  for (let i = 0; i < 3; i++) {
    const x = imgStartX + i * (imgW + imgGap);
    doc.setFillColor(248, 242, 232);
    doc.rect(x, y, imgW, imgH, 'F');
    doc.setDrawColor(...BRAND.red);
    doc.rect(x, y, imgW, imgH);
    doc.setTextColor(...BRAND.grayStone);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text(`[ DETALLE ${i + 1} ]`, x + imgW / 2, y + imgH / 2, { align: 'center' });
  }
  y += imgH + 8;

  // IDENTIFICACIÓN DEL AGENTE
  setSectionHeader('IDENTIFICACIÓN DEL AGENTE');
  addField('Agente denunciante (TIP):');
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Policía Local de Daganzo de Arriba', MARGIN_L, y);
  y += 8;
  addField('Firma:');
  y += 5;

  // NOTA LEGAL
  checkPageBreak(35);
  doc.setFillColor(...BRAND.sand);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 22, 2, 2, 'F');
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(2);
  doc.line(MARGIN_L, y, MARGIN_L, y + 22);

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NOTA LEGAL DE NOTIFICACIÓN', MARGIN_L + 3, y + 5);

  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const noteText =
    'En los supuestos de denuncia formulada sin detención del vehículo o sin presencia del denunciado, la notificación se practicará con posterioridad conforme a lo dispuesto en el artículo 90 del Texto Refundido de la Ley sobre Tráfico y en los artículos 40 y siguientes de la Ley 39/2015, de 1 de octubre.';
  const noteLines = doc.splitTextToSize(noteText, CONTENT_W - 8);
  doc.text(noteLines, MARGIN_L + 3, y + 11);

  // ==================== REVERSO ====================
  doc.addPage();
  initPage();

  // Header reverso
  doc.setFillColor(...BRAND.red);
  doc.rect(MARGIN_L - 5, 10, CONTENT_W + 10, 12, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INFORMACIÓN SOBRE EL PROCEDIMIENTO SANCIONADOR', PAGE_W / 2, 18, { align: 'center' });
  y = 32;

  // PLAZO PARA ACTUAR
  setSectionHeader('PLAZO PARA ACTUAR');
  addParagraph(
    'El interesado dispone de un plazo de VEINTE (20) DÍAS NATURALES, contados desde el día siguiente al de la notificación, para:'
  );
  addBulletPoint('Abonar la sanción con reducción del 50%.');
  addBulletPoint('Formular alegaciones y proponer pruebas.');
  y += 3;

  // PAGO VOLUNTARIO
  setSectionHeader('PAGO VOLUNTARIO CON REDUCCIÓN');
  addParagraph('El pago dentro del plazo indicado implicará:');
  addBulletPoint('Reducción del 50% del importe de la sanción.');
  addBulletPoint('Renuncia a formular alegaciones o recursos.');
  addBulletPoint('Terminación del procedimiento sin resolución expresa.');
  addBulletPoint('Firmeza de la sanción en vía administrativa.');
  y += 3;

  // FORMAS DE PAGO
  checkPageBreak(50);
  setSectionHeader('FORMAS DE PAGO');

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ONLINE:', MARGIN_L, y);
  y += 4;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.text('www.ayto-daganzo.org', MARGIN_L + 20, y);
  const urlW = doc.getTextWidth('www.ayto-daganzo.org');
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L + 20, y + 1, MARGIN_L + 20 + urlW, y + 1);
  y += 8;

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESENCIAL:', MARGIN_L, y);
  y += 4;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  addParagraph('Caja Municipal – Plaza de la Villa, 1');
  addParagraph('28814 Daganzo de Arriba (Madrid)');
  addParagraph('Horario: de lunes a viernes, de 09:00 a 14:00 horas');
  y += 3;

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSFERENCIA BANCARIA:', MARGIN_L, y);
  y += 5;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('IBAN: ES12 3456 7890 1234 5678 9012', MARGIN_L + 5, y);
  y += 5;
  doc.text('Concepto: Número de expediente', MARGIN_L + 5, y);
  y += 8;

  // ALEGACIONES
  setSectionHeader('ALEGACIONES Y PRUEBAS');
  addParagraph(
    'Podrán presentarse en el plazo de 20 días naturales ante el órgano instructor, debiendo contener:'
  );
  addBulletPoint('Número de expediente');
  addBulletPoint('Datos del interesado');
  addBulletPoint('Exposición motivada de los hechos');
  y += 3;

  // PROCEDIMIENTO Y RECURSOS
  setSectionHeader('PROCEDIMIENTO Y RECURSOS');
  addParagraph('El procedimiento se tramitará conforme al Real Decreto 320/1994.');
  y += 2;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Contra la resolución:', MARGIN_L, y);
  y += 5;
  addBulletPoint('Recurso de alzada (1 mes) ante el órgano competente municipal');
  addBulletPoint(
    'Recurso contencioso-administrativo ante los Juzgados de Madrid conforme a la Ley 29/1998'
  );
  y += 3;

  // PRESCRIPCIÓN
  checkPageBreak(40);
  setSectionHeader('PRESCRIPCIÓN');

  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Infracciones:', MARGIN_L, y);
  y += 5;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  addBulletPoint('Leves: 3 meses');
  addBulletPoint('Graves: 6 meses');
  addBulletPoint('Muy graves: 1 año');
  y += 2;
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.text('Sanciones:', MARGIN_L, y);
  y += 5;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  addBulletPoint('1 año');
  y += 3;

  // EJECUCIÓN FORZOSA
  setSectionHeader('EJECUCIÓN FORZOSA');
  addParagraph('En caso de impago:');
  addBulletPoint('Inicio de vía ejecutiva');
  addBulletPoint('Recargos e intereses');
  addBulletPoint('Costas');
  addBulletPoint('Embargo de bienes y derechos');
  y += 5;

  // PROTECCIÓN DE DATOS
  checkPageBreak(90);
  addHorizontalLine();
  setTitle('PROTECCIÓN DE DATOS PERSONALES', 11);
  y += 3;

  const pdSections = [
    { title: 'Responsable', content: 'Ayuntamiento de Daganzo de Arriba' },
    {
      title: 'Finalidad',
      content:
        'Gestión del procedimiento sancionador, control del tráfico y seguridad vial, prevención e investigación de infracciones.',
    },
    {
      title: 'Base jurídica',
      content:
        'Ejercicio de potestades públicas, cumplimiento legal conforme al R.D.L. 6/2015. Tratamientos con fines policiales conforme a la L.O. 7/2021.',
    },
    { title: 'Datos tratados', content: 'Identificativos, Vehículo, Infracción, Imágenes' },
    {
      title: 'Conservación',
      content: 'Durante el procedimiento y plazos legales de prescripción.',
    },
    { title: 'Destinatarios', content: 'DGT, Órganos judiciales, Administraciones públicas' },
    {
      title: 'Derechos',
      content: 'Acceso, rectificación, supresión, limitación y oposición (cuando proceda).',
    },
  ];

  pdSections.forEach((section) => {
    doc.setTextColor(...BRAND.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(section.title + ':', MARGIN_L, y);
    y += 4;
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(section.content, CONTENT_W - 3);
    lines.forEach((line: string) => {
      doc.text(line, MARGIN_L + 3, y);
      y += 4;
    });
    y += 3;
  });

  // Videovigilancia
  checkPageBreak(30);
  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Videovigilancia:', MARGIN_L, y);
  y += 4;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  const vidLines = doc.splitTextToSize(
    'Las imágenes son obtenidas por sistemas autorizados, constituyen prueba válida y se custodian con garantías legales. El acceso podrá limitarse por seguridad pública o derechos de terceros.',
    CONTENT_W
  );
  vidLines.forEach((line: string) => {
    doc.text(line, MARGIN_L + 3, y);
    y += 4;
  });
  y += 3;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Seguridad:', MARGIN_L, y);
  y += 4;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  addParagraph(
    'Se aplican medidas técnicas y organizativas adecuadas conforme al principio de responsabilidad proactiva.'
  );
  y += 2;

  doc.setTextColor(...BRAND.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Autoridad de control:', MARGIN_L, y);
  y += 4;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  addParagraph('Agencia Española de Protección de Datos');

  // VALIDACIÓN JURÍDICA FINAL
  checkPageBreak(25);
  y += 5;
  addHorizontalLine();
  doc.setFillColor(...BRAND.cream);
  doc.roundedRect(MARGIN_L, y, CONTENT_W, 18, 2, 2, 'F');
  doc.setTextColor(...BRAND.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('VALIDACIÓN JURÍDICA FINAL', PAGE_W / 2, y + 6, { align: 'center' });
  y += 10;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  const valText =
    'El presente documento se ajusta a la normativa vigente en materia de tráfico, procedimiento administrativo y protección de datos, garantizando la plena validez jurídica del expediente sancionador y los derechos del interesado.';
  const valLines = doc.splitTextToSize(valText, CONTENT_W);
  valLines.forEach((line: string) => {
    doc.text(line, MARGIN_L + 3, y);
    y += 4;
  });

  // Footer
  y = PAGE_H - 15;
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_L - 5, y - 5, MARGIN_R + 5, y - 5);
  doc.setTextColor(...BRAND.grayStone);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('AYUNTAMIENTO DE DAGANZO DE ARRIBA - POLICÍA LOCAL', PAGE_W / 2, y, { align: 'center' });

  // Guardar
  const buffer = doc.output('arraybuffer');
  await writeFile('Boletin_Denuncia_Modelo.pdf', Buffer.from(buffer));
  console.log('PDF generado: Boletin_Denuncia_Modelo.pdf');
};

generateSamplePdf().catch(console.error);
