import { Clock, AlertCircle, CheckCircle, Ban, Shield, FileText } from 'lucide-react';

export const getPriorityBadgeStyle = (state?: string) => {
  const styles: Record<string, any> = {
    DETECTED: {
      bgColor: 'bg-blue-600/15',
      borderColor: 'border-blue-500/40',
      textColor: 'text-blue-400',
      icon: Clock,
      label: 'DETECTADO',
    },
    UNDER_REVIEW: {
      bgColor: 'bg-yellow-600/15',
      borderColor: 'border-yellow-500/40',
      textColor: 'text-yellow-400',
      icon: AlertCircle,
      label: 'REVISIÓN',
    },
    VALIDATED: {
      bgColor: 'bg-green-600/15',
      borderColor: 'border-green-500/40',
      textColor: 'text-green-400',
      icon: CheckCircle,
      label: 'VALIDADO',
    },
    REJECTED: {
      bgColor: 'bg-red-600/15',
      borderColor: 'border-red-500/40',
      textColor: 'text-red-400',
      icon: Ban,
      label: 'RECHAZADO',
    },
    SIGNED: {
      bgColor: 'bg-purple-600/15',
      borderColor: 'border-purple-500/40',
      textColor: 'text-purple-400',
      icon: Shield,
      label: 'FIRMADO',
    },
    EXPORTED: {
      bgColor: 'bg-cyan-600/15',
      borderColor: 'border-cyan-500/40',
      textColor: 'text-cyan-400',
      icon: FileText,
      label: 'EXPORTADO',
    },
  };

  return (
    styles[state || ''] || {
      bgColor: 'bg-slate-600/15',
      borderColor: 'border-slate-500/40',
      textColor: 'text-slate-400',
      icon: Clock,
      label: state || 'DESCONOCIDO',
    }
  );
};

export const getSeverityStyle = (severity?: string): string => {
  const severityUpper = String(severity || '').toUpperCase();
  if (severityUpper === 'CRITICAL' || severityUpper === 'CRÍTICA')
    return 'bg-red-500/10 border-red-500/20 text-red-500';
  if (severityUpper === 'HIGH' || severityUpper === 'ALTA')
    return 'bg-orange-500/10 border-orange-500/20 text-orange-500';
  if (severityUpper === 'MEDIUM' || severityUpper === 'MEDIA')
    return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500';
  if (severityUpper === 'LOW' || severityUpper === 'BAJA')
    return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500';
  return 'bg-slate-500/10 border-slate-500/20 text-slate-500';
};

const INFRACTION_TYPE_MAP: Record<string, string> = {
  STOP_NO_DETENCION: 'STOP - NO DETENCIÓN',
  CEDA_NO_RESPETADO: 'CEDA EL PASO',
  PRIORIDAD_PEATONAL: 'PRIORIDAD PEATONAL',
  SEMAFORO_ROJO: 'SEMÁFORO EN ROJO',
  GIRO_PROHIBIDO: 'GIRO PROHIBIDO',
  DIRECCION_OBLIGATORIA_INCUMPLIDA: 'DIRECCIÓN OBLIGATORIA',
  FORBIDDEN_TURN: 'GIRO PROHIBIDO',
  STOP: 'STOP',
  SPEED_VIOLATION: 'EXCESO VELOCIDAD',
  OTHER: 'OTRA INFRACCIÓN',
  SENTIDO_CONTRARIO: 'SENTIDO CONTRARIO',
  DOBLE_FILA: 'DOBLE FILA',
  BLOQUEO_INTERSECCION: 'BLOQUEO INTERSECCIÓN',
  CARRIL_BUS: 'CARRIL BUS',
  INVASION_ARCEN: 'INVASIÓN ARCÉN',
  LINEA_CONTINUA: 'LÍNEA CONTINUA',
  BLOQUEO_PASO_PEATONAL: 'BLOQUEO PASO PEATONAL',
  NO_CEDER_PASO: 'NO CEDER EL PASO',
  ESTACIONAMIENTO_PROHIBIDO: 'ESTACIONAMIENTO PROHIBIDO',
  INVASION_CARRIL_CONTRARIO: 'INVASIÓN CARRIL CONTRARIO',
  CIRCULACION_PROHIBIDA: 'CIRCULACIÓN PROHIBIDA',
};

export const translateType = (tipo?: string): string =>
  INFRACTION_TYPE_MAP[String(tipo || '').toUpperCase()] || String(tipo || 'OTRA');

export const normalizeRuleToken = (value: any): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const LEGAL_ARTICLE_TEXT: Record<string, string> = {
  ART_74_RGC:
    'SE PROHÍBE REALIZAR GIROS O CAMBIOS DE DIRECCIÓN EN LOS LUGARES DONDE EXISTA SEÑALIZACIÓN QUE LO IMPIDA O CUANDO LA MANIOBRA NO ESTÉ AUTORIZADA.',
  ART_76_J_TRLTSV:
    'CONSTITUYE INFRACCIÓN GRAVE INCUMPLIR LAS SEÑALES, MARCAS VIALES Y ÓRDENES DE CIRCULACIÓN CUANDO AFECTE A LA SEGURIDAD VIAL.',
  ART_151_RGC:
    'ANTE LA SEÑAL DE STOP, EL CONDUCTOR DEBE DETENERSE COMPLETAMENTE ANTES DE REANUDAR LA MARCHA.',
  ART_57_RGC:
    'EL CONDUCTOR ESTÁ OBLIGADO A CEDER EL PASO CUANDO ASÍ LO IMPONGAN LA SEÑALIZACIÓN O LAS NORMAS DE PRIORIDAD.',
  ART_146_RGC:
    'LOS VEHÍCULOS DEBEN RESPETAR LAS INDICACIONES DE LOS SEMÁFOROS Y DETENERSE ANTE LA LUZ ROJA.',
};

export const expandArticleText = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const key = normalizeRuleToken(raw);
  if (LEGAL_ARTICLE_TEXT[key]) return `${raw} — ${LEGAL_ARTICLE_TEXT[key]}`;
  const byFragment = Object.entries(LEGAL_ARTICLE_TEXT).find(([k]) => key.includes(k));
  return byFragment ? `${raw} — ${byFragment[1]}` : raw;
};

export const formatFieldValue = (value: any, label: string): string => {
  if (typeof value !== 'number') {
    return String(value).toUpperCase();
  }
  if (label.toLowerCase().includes('euro')) {
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }
  if (label.toLowerCase().includes('confidence')) {
    return `${value.toFixed(2)}%`;
  }
  return String(value).toUpperCase();
};
