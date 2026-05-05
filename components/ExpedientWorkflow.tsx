/**
 * Expedient Workflow UI - Rediseñado
 * Contiene TODOS los campos del schema.sql, diseño idéntico a InfractionFeed
 */
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Ban,
  Clock,
  AlertCircle,
  Shield,
  Zap,
  FileText,
  Gavel,
  Car,
  MapPin,
  User,
  FileBadge,
  Image,
  Video,
  Hash,
  Ruler,
  Building,
  Flag,
  Link,
  Dna,
  Fingerprint,
  Globe,
  Calendar,
  Eye,
  Layers,
} from 'lucide-react';
import { Expedient } from '../domain/Expedient';
import { ExpedientStateMachine } from '../domain/ExpedientStateMachine';
import { SignatureService } from '../services/SignatureService';
import { getExpedientService } from '../services/ExpedientService';
import { getApiUrl } from '../services/apiConfig';
import { FORENSIC_RULES } from '../types/forensicRules';
import { evidenceDB } from '../services/EvidenceDB';
import { calculateSHA256 } from '../services/ChainOfCustodyService';
import { custodyLog, CustodyLogService } from '../services/CustodyLogService';
import {
  getPriorityBadgeStyle,
  getSeverityStyle,
  translateType,
  normalizeRuleToken,
  expandArticleText,
  formatFieldValue,
} from '../utils/infractionFormatters';
import { DataRow } from './DataRow';

interface ExpedientWorkflowProps {
  expedient: Expedient;
  onStateChange: (expedient: Expedient) => void;
  currentUser: { name: string; role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN' };
  infractionRow?: Record<string, any> | null;
  expedientImages?: string[];
}

interface CustodyCheckRow {
  fileName: string;
  kind: 'ORIGINAL' | 'PROCESADA' | 'REPORTE';
  expectedHash: string;
  calculatedHash: string;
  isValid: boolean;
  checkedAt: string;
  note?: string;
}

interface CustodyLastRun {
  at: string;
  status: 'SUCCESS' | 'FAILURE';
  summary: string;
  okCount?: number;
  failCount?: number;
  unverifiableCount?: number;
}


export const ExpedientWorkflow: React.FC<ExpedientWorkflowProps> = ({
  expedient,
  onStateChange,
  currentUser,
  infractionRow = null,
  expedientImages = [],
}) => {
  const sessionOperator =
    sessionStorage.getItem('currentUserName') || currentUser.name || 'OPERADOR';
  const [isLoading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showManualPlateModal, setShowManualPlateModal] = useState(false);
  const [manualPlateInput, setManualPlateInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgBrightness, setImgBrightness] = useState(1);
  const [imgContrast, setImgContrast] = useState(1);
  const [imgSaturate, setImgSaturate] = useState(1);
  const [imgSharpness, setImgSharpness] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [dbEvidence, setDbEvidence] = useState<{
    contextSnapshots?: string[];
    zoomSnapshots?: string[];
    snapshots?: string[];
    clip?: string;
  } | null>(null);
  const [custodyRows, setCustodyRows] = useState<CustodyCheckRow[]>([]);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [custodyLastRun, setCustodyLastRun] = useState<CustodyLastRun | null>(null);

  const priorityStyle = getPriorityBadgeStyle(expedient.state);
  const PriorityIcon = priorityStyle.icon;
  const severityClass = getSeverityStyle(expedient.gravedad || (expedient as any).severity);
  const normalizeMediaSrc = (value: any, kind: 'image' | 'video'): string => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (
      raw.startsWith('data:') ||
      raw.startsWith('blob:') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://')
    ) {
      return raw;
    }
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.length > 120) {
      const mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
      return `data:${mime};base64,${raw.replace(/\s+/g, '')}`;
    }
    if (raw.startsWith('/')) return getApiUrl(raw);
    return raw;
  };
  const parseMediaArray = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed))
            return parsed.map((x) => String(x || '').trim()).filter(Boolean);
        } catch {
          return [];
        }
      }
      return [raw];
    }
    return [];
  };

  useEffect(() => {
    let cancelled = false;
    const loadEvidence = async () => {
      try {
        const evId = String(
          (expedient as any).evidenceId || (expedient as any).evidence_id || ''
        ).trim();
        if (!evId) {
          setDbEvidence(null);
          return;
        }
        const data = await evidenceDB.getEvidence(evId);
        if (!cancelled) setDbEvidence(data as any);
      } catch {
        if (!cancelled) setDbEvidence(null);
      }
    };
    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [expedient.id, (expedient as any).evidenceId, (expedient as any).evidence_id]);

  const handleTransition = async (action: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let result;
      switch (action) {
        case 'review':
          result = ExpedientStateMachine.transitionToUnderReview(expedient, currentUser.name);
          break;
        case 'validate':
          result = ExpedientStateMachine.transitionToValidated(expedient, currentUser.name, {
            isValid: true,
            evidenceVerified: true,
            plateVerified: true,
            speedVerified: expedient.violationType === 'SPEED_VIOLATION',
          });
          break;
        case 'reject':
          result = ExpedientStateMachine.transitionToRejected(
            expedient,
            currentUser.name,
            rejectionReason
          );
          break;
        case 'sign': {
          const hash = await SignatureService.signExpedient(expedient, currentUser.name, {
            method: 'digital',
          });
          result = ExpedientStateMachine.transitionToSigned(expedient, currentUser.name, hash);
          break;
        }
        case 'export':
          result = ExpedientStateMachine.transitionToExported(expedient, currentUser.name);
          break;
      }
      if (result?.success) {
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess(
          `Expediente ${action === 'sign' ? 'firmado' : action === 'validate' ? 'validado' : action === 'review' ? 'en revisión' : action === 'reject' ? 'rechazado' : 'exportado'}`
        );
        onStateChange(expedient);
      } else {
        setError(result?.error || 'Error en la transición');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Desconocido'}`);
    }
    setIsLoading(false);
  };

  const normalizePlateInput = (value: string): string =>
    String(value || '')
      .toUpperCase()
      .replace(/[\s_.:-]/g, '')
      .replace(/[^A-Z0-9]/g, '');

  const isValidManualPlate = (value: string): boolean => {
    const p = normalizePlateInput(value);
    return /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(p) || /^[A-Z0-9]{6,8}$/.test(p);
  };

  const handleManualPlateConfirm = async () => {
    const normalized = normalizePlateInput(manualPlateInput);
    if (!isValidManualPlate(normalized)) {
      setError('Matrícula manual no válida.');
      return;
    }
    try {
      const currentAuditLog = Array.isArray((expedient as any).auditLog)
        ? [...(expedient as any).auditLog]
        : [];
      currentAuditLog.push({
        timestamp: Date.now(),
        action: 'MANUAL_PLATE_SET',
        actor: sessionOperator,
        details: { plate: normalized, reason: '5min timeout without valid OCR plate' },
      });
      const updatedExpedient = {
        ...expedient,
        licensePlate: normalized,
        plateOcr: normalized,
        operator: sessionOperator,
        auditLog: currentAuditLog,
      } as any;
      const service = getExpedientService();
      await service.updateExpedient(updatedExpedient);
      setShowManualPlateModal(false);
      setManualPlateInput('');
      setSuccess(`Matrícula manual registrada: ${normalized}`);
      onStateChange(updatedExpedient);
    } catch (e) {
      setError(
        `No se pudo guardar matrícula manual: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  const plate =
    (expedient as any).licensePlate ||
    (expedient as any).license_plate ||
    (expedient as any).plateOcr ||
    (expedient as any).placa ||
    (infractionRow as any)?.plate ||
    expedient.ocrResults?.placa ||
    'DESCONOCIDO';
  const isPlateUnknown = ['DESCONOCIDO', 'UNKNOWN', '', 'NO_PLATE'].includes(
    String(plate || '').toUpperCase()
  );
  const infractionExtraData = ((infractionRow as any)?.extra_data || {}) as Record<string, any>;
  const auditResult = ((infractionRow as any)?.audit_result || {}) as Record<string, any>;
  const makeModelRaw =
    (expedient as any).makeModel ||
    (expedient as any).vehicleDescription ||
    (infractionRow as any)?.make_model ||
    infractionExtraData.make_model ||
    '';
  const normalizeUnknown = (v: any): string => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (['UNKNOWN', 'N/A', 'NA', '-', 'NULL', 'UNDEFINED'].includes(s.toUpperCase()))
      return 'DESCONOCIDO';
    return s;
  };
  const rawBrand = normalizeUnknown((expedient as any).marca || infractionExtraData.marca);
  const rawModel = normalizeUnknown((expedient as any).modelo || infractionExtraData.modelo);
  const rawColor = normalizeUnknown((expedient as any).color || (infractionRow as any)?.color);

  const makeModelParts = String(makeModelRaw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const inferredBrand = rawBrand || normalizeUnknown(makeModelParts[0] || '');
  const inferredModelFromCombined = normalizeUnknown(makeModelParts.slice(1).join(' '));
  let inferredModel = rawModel || inferredModelFromCombined;
  // Avoid duplicated semantic collisions (e.g., model=BLANCO due to bad source mapping)
  if (rawColor && inferredModel && rawColor.toUpperCase() === inferredModel.toUpperCase()) {
    inferredModel = '';
  }
  if (rawColor && inferredBrand && rawColor.toUpperCase() === inferredBrand.toUpperCase()) {
    // keep explicit brand if available; otherwise mark unknown
    if (!rawBrand) {
      // only inferred from noisy combined field
      inferredModel = inferredModel || 'DESCONOCIDO';
    }
  }
  const sancionImporte =
    (expedient as any).sancionEuros ??
    (expedient as any).sancion_euros ??
    (expedient as any).fineAmount ??
    (infractionRow as any)?.fine_amount ??
    infractionExtraData.sancion_euros ??
    infractionExtraData.fine_amount;
  const sancionPuntos =
    (expedient as any).puntosDetraccion ??
    (expedient as any).puntos_detraccion ??
    (expedient as any).pointsDeducted ??
    (infractionRow as any)?.points_deducted ??
    infractionExtraData.puntos_detraccion ??
    infractionExtraData.points_deducted;
  const textoArtConducta =
    (expedient as any).articuloConductaTexto ||
    (expedient as any).articulo_conducta_texto ||
    infractionExtraData.articulo_conducta_texto ||
    auditResult.articulo_conducta_texto ||
    auditResult.norma_conducta_texto ||
    (expedient as any).legalBase ||
    (infractionRow as any)?.legal_base ||
    'NO DISPONIBLE';
  const textoArtSancion =
    (expedient as any).articuloSancionadorTexto ||
    (expedient as any).articulo_sancionador_texto ||
    infractionExtraData.articulo_sancionador_texto ||
    infractionExtraData.norma_sancionadora_texto ||
    auditResult.articulo_sancionador_texto ||
    auditResult.norma_sancionadora_texto ||
    (infractionRow as any)?.legal_base ||
    'NO DISPONIBLE';
  const definicionInfraccion =
    (expedient as any).definicionInfraccion ||
    (expedient as any).definicion_infraccion ||
    infractionExtraData.definicion_infraccion ||
    auditResult.definicion_infraccion ||
    (expedient as any).description ||
    (infractionRow as any)?.description ||
    'NO DISPONIBLE';

  const formatDateTime = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'number') return new Date(value).toLocaleString();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
    return String(value);
  };
  const dateDenuncia =
    formatDateTime((expedient as any).createdAt) ||
    formatDateTime((expedient as any).created_at) ||
    formatDateTime((infractionRow as any)?.created_at);
  const horaDenuncia = (() => {
    if ((expedient as any).createdAt)
      return new Date((expedient as any).createdAt).toLocaleTimeString();
    if ((expedient as any).created_at)
      return new Date((expedient as any).created_at).toLocaleTimeString();
    if ((infractionRow as any)?.created_at)
      return new Date((infractionRow as any).created_at).toLocaleTimeString();
    return '';
  })();
  const horaInfraccion =
    (expedient as any).videoTimeCode ||
    (expedient as any).video_time_code ||
    (infractionRow as any)?.video_time_code ||
    (infractionRow as any)?.time ||
    (infractionRow as any)?.local_time ||
    formatDateTime((expedient as any).timestamp) ||
    formatDateTime((expedient as any).fechaHora);
  const parseFechaHora = (value: any): { fecha: string; hora: string } => {
    const raw = String(value || '').trim();
    if (!raw) return { fecha: '', hora: '' };

    // Epoch support (seconds/milliseconds)
    if (/^\d{10,13}$/.test(raw)) {
      const num = Number(raw);
      const ms = raw.length === 10 ? num * 1000 : num;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        return { fecha: d.toLocaleDateString(), hora: d.toLocaleTimeString() };
      }
    }

    // 1) Attempt Date parse first
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      return {
        fecha: dt.toLocaleDateString(),
        hora: dt.toLocaleTimeString(),
      };
    }

    // 2) Extract common OSD patterns DD/MM/YYYY HH:MM:SS
    const m = raw.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).*?(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (m) return { fecha: m[1], hora: m[2] };

    // 3) Time only fallback
    const t = raw.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/);
    if (t) return { fecha: '', hora: t[0] };

    return { fecha: raw, hora: '' };
  };
  const infractionDateTimeSource =
    (expedient as any).videoTimeCode ||
    (expedient as any).video_time_code ||
    (infractionRow as any)?.video_time_code ||
    (expedient as any).visualTimestamp ||
    (infractionRow as any)?.visual_timestamp ||
    (expedient as any).timestamp;
  const infractionParsed = parseFechaHora(infractionDateTimeSource);
  const infractionTypeRaw =
    (expedient as any).violationType ||
    (expedient as any).type ||
    (infractionRow as any)?.rule_category ||
    (infractionRow as any)?.audit_result?.ruleCategory ||
    'OTHER';
  const normalizedInfractionType = normalizeRuleToken(infractionTypeRaw);
  const normalizedRuleCategory = normalizeRuleToken(
    (expedient as any).ruleCategory || (infractionRow as any)?.rule_category
  );
  const ruleAliases: Record<string, string[]> = {
    GIRO_PROHIBIDO: ['GIRO_PROHIBIDO', 'FORBIDDEN_TURN', 'RULE_GIRO_PROHIBIDO'],
  };
  const typeCandidates = [
    normalizedInfractionType,
    normalizedRuleCategory,
    ...(ruleAliases[normalizedInfractionType] || []),
  ].filter(Boolean);
  const matchedRule =
    FORENSIC_RULES.find(
      (r) =>
        typeCandidates.includes(normalizeRuleToken(r.operativeCode)) ||
        typeCandidates.includes(normalizeRuleToken(r.name)) ||
        typeCandidates.includes(normalizeRuleToken(r.id))
    ) || FORENSIC_RULES.find((r) => normalizeRuleToken(r.operativeCode) === normalizedRuleCategory);
  const canonicalRuleCode = (() => {
    const t = `${normalizedInfractionType} ${normalizedRuleCategory}`;
    if (t.includes('GIRO_PROHIBIDO') || t.includes('FORBIDDEN_TURN') || t.includes('GIRO'))
      return 'GIRO_PROHIBIDO';
    if (t.includes('SEMAFORO_ROJO')) return 'SEMAFORO_ROJO';
    if (t.includes('STOP')) return 'STOP_NO_DETENCION';
    if (t.includes('CEDA')) return 'CEDA_NO_RESPETADO';
    return '';
  })();
  const canonicalRule =
    (canonicalRuleCode
      ? FORENSIC_RULES.find((r) => normalizeRuleToken(r.operativeCode) === canonicalRuleCode)
      : null) || matchedRule;
  const textoArtConductaResolved =
    textoArtConducta === 'NO DISPONIBLE'
      ? canonicalRule?.legalBase?.[0] || canonicalRule?.conduct || 'NO DISPONIBLE'
      : textoArtConducta;
  const textoArtSancionResolved =
    textoArtSancion === 'NO DISPONIBLE'
      ? canonicalRule?.legalBase?.[1] ||
        canonicalRule?.legalBase?.[0] ||
        canonicalRule?.citation ||
        'NO DISPONIBLE'
      : textoArtSancion;
  const textoArtConductaExpanded = expandArticleText(textoArtConductaResolved);
  const textoArtSancionExpanded = expandArticleText(textoArtSancionResolved);
  const definicionInfraccionResolved =
    definicionInfraccion === 'NO DISPONIBLE'
      ? canonicalRule?.conduct || canonicalRule?.citation || 'NO DISPONIBLE'
      : definicionInfraccion;
  const sancionImporteResolved =
    sancionImporte ??
    (canonicalRule as any)?.sanctions?.fine_eur ??
    (canonicalRule as any)?.sanctions?.baseAmount ??
    'NO DISPONIBLE';
  const sancionPuntosResolved =
    sancionPuntos ?? (canonicalRule as any)?.sanctions?.points ?? 'NO DISPONIBLE';
  const riesgoAsociadoResolved =
    (expedient as any).riesgo_nivel ||
    ((expedient as any).is_criminal_risk ? 'SÍ' : '') ||
    (canonicalRule as any)?.sanctions?.risk_score ||
    (canonicalRule as any)?.sanctions?.priority ||
    'NO';
  const mainImage =
    (expedient as any).main_image_url ||
    expedient.evidence?.photos?.[0] ||
    expedient.thumbnail ||
    '';
  const infractionMainImage = infractionRow?.image_url || '';
  const infractionExtraSnapshots = parseMediaArray(infractionRow?.extra_snapshots);
  const infractionZoomSnapshots = parseMediaArray(infractionRow?.zoom_snapshots);
  const localExtraSnapshots = parseMediaArray((expedient as any).extraSnapshots);
  const localZoomSnapshots = parseMediaArray((expedient as any).zoomSnapshots);
  const dbGeneralSnapshots = parseMediaArray((dbEvidence as any)?.contextSnapshots);
  const dbDetailSnapshots = parseMediaArray((dbEvidence as any)?.zoomSnapshots);
  const dbRawSnapshots = parseMediaArray((dbEvidence as any)?.snapshots);
  const galleryImages = [
    mainImage,
    infractionMainImage,
    ...expedientImages,
    ...localExtraSnapshots,
    ...localZoomSnapshots,
    ...dbGeneralSnapshots,
    ...dbDetailSnapshots,
    ...dbRawSnapshots,
    ...infractionExtraSnapshots,
    ...infractionZoomSnapshots,
  ]
    .map((src) => normalizeMediaSrc(src, 'image'))
    .filter(Boolean);
  const uniqueGalleryImages = [...new Set(galleryImages)];
  const videoCandidates = [
    (expedient as any).video_clip_url,
    (expedient as any).videoClip,
    (dbEvidence as any)?.clip,
    infractionRow?.video_clip_url,
    infractionRow?.video_clip,
  ]
    .map((src) => normalizeMediaSrc(src, 'video'))
    .filter(Boolean);
  const uniqueVideoCandidates = [...new Set(videoCandidates)];
  const videoUrl = uniqueVideoCandidates[videoIndex] || '';

  const rawMediaWeight = (src: string): number => {
    const value = String(src || '');
    const comma = value.indexOf(',');
    if (comma >= 0 && value.startsWith('data:')) return value.length - comma - 1;
    return value.length;
  };

  const prioritizedManualPlateImages = [
    ...dbDetailSnapshots,
    ...localZoomSnapshots,
    ...infractionZoomSnapshots,
    ...dbGeneralSnapshots,
    ...localExtraSnapshots,
    ...infractionExtraSnapshots,
    ...uniqueGalleryImages,
  ]
    .map((src) => normalizeMediaSrc(src, 'image'))
    .filter(Boolean)
    .filter((src, idx, arr) => arr.indexOf(src) === idx)
    .sort((a, b) => rawMediaWeight(b) - rawMediaWeight(a))
    .slice(0, 8);

  useEffect(() => {
    setVideoIndex(0);
  }, [expedient.id]);

  useEffect(() => {
    if (!isPlateUnknown) return;
    const createdAtMs =
      Number((expedient as any).createdAt) ||
      new Date((expedient as any).created_at || 0).getTime() ||
      Date.now();
    const elapsed = Date.now() - createdAtMs;
    const delay = Math.max(0, 5 * 60 * 1000 - elapsed);
    const timer = window.setTimeout(() => {
      const hasEvidence = uniqueGalleryImages.length > 0 || !!videoUrl;
      if (hasEvidence) setShowManualPlateModal(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [expedient.id, isPlateUnknown, uniqueGalleryImages.length, videoUrl]);

  const sectionTitleClass = 'text-sm font-bold uppercase tracking-wide text-slate-100';
  const sectionBlockClass = 'border-t border-white/10 pt-3 space-y-1.5';
  const imageFilterStyle = {
    transform: `scale(${imgZoom})`,
    filter: `brightness(${imgBrightness}) contrast(${imgContrast}) saturate(${imgSaturate}) drop-shadow(0 0 ${imgSharpness}px rgba(255,255,255,0.4))`,
  } as React.CSSProperties;

  const toBlobIfDataUrl = async (value: string): Promise<Blob | null> => {
    if (!value) return null;
    const src = String(value).trim();
    if (!src.startsWith('data:')) return null;
    try {
      const commaIdx = src.indexOf(',');
      if (commaIdx < 0) return null;
      const header = src.slice(0, commaIdx);
      const payload = src.slice(commaIdx + 1);
      const mimeMatch = header.match(/^data:([^;]+);base64$/i);
      if (!mimeMatch) return null;
      const mime = mimeMatch[1] || 'application/octet-stream';
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  };

  const shortHash = (value?: string): string => {
    const v = String(value || '');
    if (!v) return '';
    return v.length > 16 ? `${v.slice(0, 16)}...` : v;
  };

  const runCustodyVerification = async () => {
    setCustodyLoading(true);
    try {
      const rows: CustodyCheckRow[] = [];
      const checkedAt = new Date().toLocaleString();

      const firstContext = dbGeneralSnapshots[0] || localExtraSnapshots[0] || '';
      const firstZoom =
        dbDetailSnapshots[0] ||
        localZoomSnapshots[0] ||
        uniqueGalleryImages[Math.max(0, uniqueGalleryImages.length - 1)] ||
        '';
      const contextExpected = String((dbEvidence as any)?.contextHash || '').toLowerCase();
      const zoomExpected = String((dbEvidence as any)?.zoomHash || '').toLowerCase();
      const videoExpected = String((expedient as any).videoClipHash || '').toLowerCase();

      const candidates = [
        { fileName: 'context_snapshot', kind: 'ORIGINAL' as const, src: firstContext, expected: contextExpected },
        { fileName: 'zoom_snapshot', kind: 'PROCESADA' as const, src: firstZoom, expected: zoomExpected },
        { fileName: 'video_clip', kind: 'ORIGINAL' as const, src: videoUrl, expected: videoExpected },
      ];

      for (const item of candidates) {
        if (!item.src) {
          rows.push({
            fileName: item.fileName,
            kind: item.kind,
            expectedHash: shortHash(item.expected),
            calculatedHash: '',
            isValid: true,
            checkedAt,
            note: 'Sin archivo disponible',
          });
          continue;
        }

        const blob = await toBlobIfDataUrl(item.src);
        if (!blob) {
          rows.push({
            fileName: item.fileName,
            kind: item.kind,
            expectedHash: shortHash(item.expected),
            calculatedHash: '',
            isValid: true,
            checkedAt,
            note: 'No verificable (origen no base64)',
          });
          continue;
        }

        const calculated = (await calculateSHA256(blob)).toLowerCase();
        const valid = !!item.expected && calculated === item.expected;

        rows.push({
          fileName: item.fileName,
          kind: item.kind,
          expectedHash: shortHash(item.expected),
          calculatedHash: shortHash(calculated),
          isValid: valid,
          checkedAt,
          note: item.expected ? undefined : 'Sin hash esperado registrado',
        });
      }

      setCustodyRows(rows);
      const verifiableRows = rows.filter(
        (r) => !r.note || (!r.note.includes('No verificable') && !r.note.includes('Sin archivo'))
      );
      const unverifiableRows = rows.filter(
        (r) => !!r.note && (r.note.includes('No verificable') || r.note.includes('Sin archivo'))
      );
      const allValid = verifiableRows.length > 0 && verifiableRows.every((r) => r.isValid);
      const failureCount = verifiableRows.filter((r) => !r.isValid).length;
      const okCount = verifiableRows.filter((r) => r.isValid).length;
      const unverifiableCount = unverifiableRows.length;
      const checkedAtIso = new Date().toISOString();
      const summary =
        verifiableRows.length === 0
          ? 'Sin evidencias verificables (se requiere base64 con hash esperado)'
          : allValid
            ? `Integridad verificada (${verifiableRows.length}/${verifiableRows.length} OK)`
            : `Integridad con incidencias (${failureCount}/${verifiableRows.length} FAIL)`;
      setCustodyLastRun({
        at: checkedAt,
        status: allValid ? 'SUCCESS' : 'FAILURE',
        summary,
        okCount,
        failCount: failureCount,
        unverifiableCount,
      });
      const service = getExpedientService();
      const updatedExpedient = {
        ...expedient,
        custodyLastCheckedAt: new Date(checkedAtIso).getTime(),
        custodyLastStatus: allValid ? 'SUCCESS' : 'FAILURE',
        custodyLastSummary: summary,
        custodyVerificationRows: rows,
      } as any;
      await service.updateExpedient(updatedExpedient);
      onStateChange(updatedExpedient);
      custodyLog.addEntry(
        CustodyLogService.logIntegrityCheck(
          currentUser.name || 'OPERADOR',
          expedient.id,
          allValid ? 'SUCCESS' : 'FAILURE',
          allValid
            ? undefined
            : `Verificación con incidencias (${rows.filter((r) => !r.isValid).length} de ${rows.length})`
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error en verificación';
      setCustodyRows([
        {
          fileName: 'verificacion',
          kind: 'REPORTE',
          expectedHash: '',
          calculatedHash: '',
          isValid: false,
          checkedAt: new Date().toLocaleString(),
          note: errorMessage,
        },
      ]);
      setCustodyLastRun({
        at: new Date().toLocaleString(),
        status: 'FAILURE',
        summary: errorMessage,
        okCount: 0,
        failCount: 0,
        unverifiableCount: 0,
      });
      try {
        const service = getExpedientService();
        const updatedExpedient = {
          ...expedient,
          custodyLastCheckedAt: Date.now(),
          custodyLastStatus: 'FAILURE',
          custodyLastSummary: errorMessage,
          custodyVerificationRows: [],
        } as any;
        await service.updateExpedient(updatedExpedient);
        onStateChange(updatedExpedient);
      } catch {
        // keep custody UI state even if persistence fails
      }
      custodyLog.addEntry(
        CustodyLogService.logIntegrityCheck(
          currentUser.name || 'OPERADOR',
          expedient.id,
          'FAILURE',
          errorMessage
        )
      );
    } finally {
      setCustodyLoading(false);
    }
  };

  useEffect(() => {
    runCustodyVerification().catch(() => null);
  }, [expedient.id, (dbEvidence as any)?.contextHash, (dbEvidence as any)?.zoomHash, videoUrl]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950/80">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4 min-h-0">
        <div className="group horizon-card hover:border-cyan-400/40 rounded-xl overflow-hidden transition-all shadow-[0_14px_35px_rgba(2,6,23,0.45)] border border-cyan-400/15 bg-slate-950/65">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-bold text-white font-mono tracking-tight uppercase">
                {plate}
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">
                {(expedient as any).timestamp?.toLocaleString() ||
                  expedient.fechaHora ||
                  (expedient as any).created_at?.toLocaleString() ||
                  'SIN FECHA'}
              </span>
            </div>

            <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed uppercase font-medium">
              {translateType(expedient.violationType || expedient.type)}
            </p>

            {/* CADENA DE CUSTODIA (RESUMEN VISIBLE) */}
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/[0.04] p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-200">
                  Cadena de custodia
                </p>
                <button
                  onClick={runCustodyVerification}
                  disabled={custodyLoading}
                  className="px-2 py-1 text-[10px] bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 rounded-md font-semibold uppercase tracking-wide hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  {custodyLoading ? 'Verificando...' : 'Reverificar'}
                </button>
              </div>
              <div className="text-[11px] text-slate-300">
                {custodyRows.length > 0
                  ? `Integridad: ${custodyRows.filter((r) => r.isValid).length}/${custodyRows.length} OK`
                  : 'Sin datos de verificación'}
              </div>
              {custodyLastRun ? (
                <div
                  className={`text-[10px] ${
                    custodyLastRun.status === 'SUCCESS' ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  Última verificación: {custodyLastRun.at} · {custodyLastRun.status} ·{' '}
                  {custodyLastRun.summary}
                </div>
              ) : null}
              {custodyLastRun ? (
                <div className="text-[10px] text-slate-400">
                  Desglose: OK {custodyLastRun.okCount ?? 0} · FAIL{' '}
                  {custodyLastRun.failCount ?? 0} · No verificables{' '}
                  {custodyLastRun.unverifiableCount ?? 0}
                </div>
              ) : null}
            </div>

            {/* CABECERA DEL EXPEDIENTE */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Cabecera del expediente</p>
              <DataRow icon={Hash} label="Nº expediente" value={expedient.id} mono />
              <DataRow icon={Calendar} label="Fecha denuncia" value={dateDenuncia} />
              <DataRow icon={Calendar} label="Fecha infracción" value={infractionParsed.fecha} />
              <DataRow
                icon={Clock}
                label="Hora infracción"
                value={infractionParsed.hora || horaInfraccion}
              />
            </div>

            {/* LUGAR Y CIRCUNSTANCIAS DE LA INFRACCIÓN */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Lugar y circunstancias de la infracción</p>
              <DataRow
                icon={MapPin}
                label="Vía/calle/carretera"
                value={(expedient as any).via || (expedient as any).location || expedient.ubicacion}
              />
              <DataRow
                icon={Ruler}
                label="Nº / punto kilométrico"
                value={(expedient as any).numero_punto_kilometrico}
              />
              <DataRow icon={Building} label="Municipio" value={(expedient as any).municipio} />
              <DataRow icon={Flag} label="Provincia" value={(expedient as any).provincia} />
              <DataRow
                icon={Gavel}
                label="Gravedad"
                value={(expedient as any).gravedad || (infractionRow as any)?.severity}
              />
            </div>

            {/* IDENTIFICACIÓN DEL VEHÍCULO */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Identificación del vehículo</p>
              <DataRow icon={Hash} label="Matrícula" value={plate} mono />
              <DataRow icon={Car} label="Marca" value={inferredBrand || 'DESCONOCIDO'} />
              <DataRow icon={Car} label="Modelo" value={inferredModel || 'DESCONOCIDO'} />
              <DataRow icon={Car} label="Color" value={rawColor || 'DESCONOCIDO'} />
            </div>

            {/* DESCRIPCIÓN DETALLADA DE LOS HECHOS */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Descripción detallada de los hechos</p>
              <DataRow
                icon={FileText}
                label="Tipo de infracción"
                value={translateType(infractionTypeRaw)}
              />
              <DataRow
                icon={FileText}
                label="Hechos constatados"
                justify
                value={
                  (expedient as any).descripcion_detallada_hechos ||
                  (expedient as any).description ||
                  (infractionRow as any)?.description
                }
              />
              <DataRow
                icon={AlertTriangle}
                label="Circunstancias agravantes"
                justify
                value={(expedient as any).circunstancias_agravantes}
              />
            </div>

            {/* MARCO NORMATIVO / TIPIFICACIÓN */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Marco normativo / tipificación</p>
              <DataRow
                icon={Gavel}
                label="Norma de conducta y artículo"
                value={`${(expedient as any).normaConductaNombre || (expedient as any).norma_conducta_nombre || infractionExtraData.norma_conducta_nombre || ''} ${(expedient as any).articuloConducta || (expedient as any).articulo_conducta || infractionExtraData.articulo_conducta || ''}`.trim()}
              />
              <div className="text-sm text-slate-300 border-l-2 border-purple-500/30 pl-3 py-1 mt-1 bg-white/[0.02] rounded-r">
                <p className="text-sm uppercase text-slate-300 font-semibold">
                  Texto art. conducta
                </p>
                <p className="text-sm leading-relaxed text-slate-100 text-justify">
                  {textoArtConductaExpanded}
                </p>
              </div>
              <DataRow
                icon={Gavel}
                label="Norma sancionadora y artículo"
                value={`${(expedient as any).normaSancionadoraNombre || (expedient as any).norma_sancionadora_nombre || infractionExtraData.norma_sancionadora_nombre || ''} ${(expedient as any).articuloSancionador || (expedient as any).articulo_sancionador || infractionExtraData.articulo_sancionador || ''}`.trim()}
              />
              <div className="text-sm text-slate-300 border-l-2 border-red-500/30 pl-3 py-1 mt-1 bg-white/[0.02] rounded-r">
                <p className="text-sm uppercase text-slate-300 font-semibold">Texto art. sanción</p>
                <p className="text-sm leading-relaxed text-slate-100 text-justify">
                  {textoArtSancionExpanded}
                </p>
              </div>
              <DataRow
                icon={FileText}
                label="Código/descr. de señal"
                value={`${(expedient as any).codigo_senal || ''} ${(expedient as any).descripcion_senal || ''}`.trim()}
              />
              <DataRow
                icon={FileText}
                label="Definición de infracción"
                justify
                value={definicionInfraccionResolved}
              />
              <DataRow
                icon={AlertTriangle}
                label="Riesgo asociado"
                value={riesgoAsociadoResolved}
              />
            </div>

            {/* SANCIÓN PROPUESTA */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Sanción propuesta</p>
              <DataRow icon={AlertCircle} label="Importe" value={sancionImporteResolved} mono />
              <DataRow icon={Zap} label="Puntos a detraer" value={sancionPuntosResolved} mono />
            </div>

            {/* EVIDENCIAS */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Evidencias</p>
              <DataRow
                icon={Image}
                label="Imagen principal"
                value={(expedient as any).main_image_url || infractionMainImage}
              />
              <DataRow
                icon={Image}
                label="Imágenes generales y de detalle"
                value={String(uniqueGalleryImages.length)}
              />
              <DataRow
                icon={Image}
                label="Imagen de matrícula / señal"
                value={`${(expedient as any).plate_image_url || '—'} / ${(expedient as any).signal_image_url || '—'}`}
              />
              <DataRow
                icon={Video}
                label="Clip de video"
                value={videoUrl ? 'DISPONIBLE' : 'NO DISPONIBLE'}
              />
              <DataRow
                icon={Clock}
                label="Timestamps / hash evidencia"
                value={`${(expedient as any).video_time_code || (infractionRow as any)?.video_time_code || ''} ${(expedient as any).video_clip_hash || ''}`.trim()}
              />
              {uniqueGalleryImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
                  {uniqueGalleryImages.map((src, idx) => (
                    <button
                      key={`img-${idx}`}
                      onClick={() => setSelectedImage(String(src))}
                      className="block rounded-lg border border-cyan-300/20 overflow-hidden bg-slate-950/70 hover:border-cyan-300/50 transition-colors text-left"
                    >
                      <img
                        src={String(src)}
                        alt={`EVIDENCIA ${idx + 1}`}
                        className="w-full h-24 object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              {videoUrl ? (
                <div className="rounded-lg border border-cyan-300/20 bg-slate-950/70 p-2 mt-2">
                  <video
                    key={`${expedient.id}-${videoIndex}`}
                    src={String(videoUrl)}
                    controls
                    preload="metadata"
                    className="w-full max-h-72 rounded"
                    onError={() => {
                      if (videoIndex < uniqueVideoCandidates.length - 1) {
                        setVideoIndex((prev) => prev + 1);
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* TRAZABILIDAD / ESTADO DEL EXPEDIENTE */}
            <div className={sectionBlockClass}>
              <p className={sectionTitleClass}>Trazabilidad / estado del expediente</p>
              <DataRow icon={Clock} label="Estado" value={expedient.state} />
              <DataRow
                icon={CheckCircle}
                label="Validación"
                value={
                  (infractionRow as any)?.validation_status || (expedient as any).validationStatus
                }
              />
              <DataRow
                icon={Calendar}
                label="Creado"
                value={(expedient as any).created_at?.toLocaleString()}
              />
              <DataRow
                icon={Calendar}
                label="Actualizado"
                value={(expedient as any).updated_at?.toLocaleString()}
              />
              <DataRow
                icon={Calendar}
                label="Validado"
                value={(infractionRow as any)?.validated_at || (expedient as any).validatedAt}
              />
              <DataRow
                icon={Calendar}
                label="Firmado"
                value={(expedient as any).signature_signed_at?.toLocaleString()}
              />
              <DataRow
                icon={User}
                label="Operador/supervisor"
                value={`${sessionOperator} / ${(expedient as any).supervisor || '—'}`}
              />
              <DataRow icon={Hash} label="ID expediente" value={expedient.id} mono />
              <DataRow
                icon={Hash}
                label="ID infracción"
                value={(expedient as any).infraction_id || (infractionRow as any)?.id}
                mono
              />
              <DataRow
                icon={Hash}
                label="ID evidencia"
                value={(expedient as any).evidenceId || (infractionRow as any)?.evidence_id}
                mono
              />
              <DataRow
                icon={CheckCircle}
                label="Firmado"
                value={(expedient as any).signature_is_signed ? 'SÍ' : 'NO'}
              />
            </div>

            {/* CADENA DE CUSTODIA */}
            <div className={sectionBlockClass}>
              <div className="flex items-center justify-between gap-2">
                <p className={sectionTitleClass}>Cadena de custodia</p>
                <button
                  onClick={runCustodyVerification}
                  disabled={custodyLoading}
                  className="px-2.5 py-1 text-[10px] bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 rounded-md font-semibold uppercase tracking-wide hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  {custodyLoading ? 'Verificando...' : 'Reverificar integridad'}
                </button>
              </div>
              <div className="mt-2 border border-white/10 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_0.6fr] bg-white/[0.03] text-[10px] uppercase tracking-wide text-slate-400 px-2 py-1.5">
                  <span>Archivo</span>
                  <span>Tipo</span>
                  <span>Hash esperado</span>
                  <span>Hash calc.</span>
                  <span>Estado</span>
                </div>
                {custodyRows.length === 0 ? (
                  <div className="px-2 py-2 text-[11px] text-slate-500">Sin datos de custodia</div>
                ) : (
                  custodyRows.map((row, idx) => (
                    <div
                      key={`${row.fileName}-${idx}`}
                      className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_0.6fr] px-2 py-1.5 text-[11px] border-t border-white/5 items-center"
                    >
                      <div className="text-slate-200">{row.fileName}</div>
                      <div className="text-slate-400">{row.kind}</div>
                      <div className="font-mono text-slate-300">{row.expectedHash || '—'}</div>
                      <div className="font-mono text-slate-300">{row.calculatedHash || '—'}</div>
                      <div className={row.isValid ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                        {row.isValid ? 'OK' : 'FAIL'}
                      </div>
                      {row.note ? (
                        <div className="col-span-5 text-[10px] text-slate-500 mt-0.5">{row.note}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-200/80 flex gap-3 items-start rounded-lg">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 text-emerald-200/80 flex gap-3 items-start rounded-lg">
            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={14} />
            <p className="text-sm">{success}</p>
          </div>
        )}

        {showRejectModal && (
          <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              Motivo de rechazo
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-20 bg-black/40 border border-white/10 rounded text-sm text-slate-200 p-2 resize-none"
              placeholder="Ingrese el motivo (mín. 10 caracteres)..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleTransition('reject')}
                disabled={isLoading || rejectionReason.length < 10}
                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-sm font-semibold uppercase tracking-wide disabled:opacity-40"
              >
                Confirmar
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 bg-slate-500/20 text-slate-400 rounded text-sm font-semibold uppercase tracking-wide"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showManualPlateModal && (
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">
              OCR sin matrícula válida tras 5 minutos
            </p>
            <p className="text-sm text-slate-300">
              Revise las mejores capturas HD y escriba la matrícula observada.
            </p>
            {prioritizedManualPlateImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {prioritizedManualPlateImages.slice(0, 6).map((src, i) => (
                  <button
                    key={`manual-plate-img-${i}`}
                    type="button"
                    onClick={() => setSelectedImage(String(src))}
                    className="block rounded-lg border border-cyan-300/20 overflow-hidden"
                  >
                    <img
                      src={src}
                      alt={`CAPTURA HD ${i + 1}`}
                      className="w-full h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            <input
              value={manualPlateInput}
              onChange={(e) => setManualPlateInput(e.target.value)}
              placeholder="EJ: 1234ABC"
              className="w-full bg-black/40 border border-white/10 rounded text-sm text-slate-100 p-2 uppercase"
            />
            <div className="flex gap-2">
              <button
                onClick={handleManualPlateConfirm}
                disabled={!isValidManualPlate(manualPlateInput)}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded text-sm font-semibold uppercase tracking-wide disabled:opacity-40"
              >
                Guardar matrícula
              </button>
              <button
                onClick={() => setShowManualPlateModal(false)}
                className="px-3 py-1.5 bg-slate-500/20 text-slate-300 rounded text-sm font-semibold uppercase tracking-wide"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {selectedImage && (
          <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap bg-slate-900/80 border border-white/10 rounded p-2">
              <button
                onClick={() => setImgZoom((v) => Math.max(0.5, v - 0.1))}
                className="px-2 py-1 text-xs bg-white/10 rounded"
              >
                - ZOOM
              </button>
              <button
                onClick={() => setImgZoom((v) => Math.min(4, v + 0.1))}
                className="px-2 py-1 text-xs bg-white/10 rounded"
              >
                + ZOOM
              </button>
              <label className="text-xs text-slate-200">BRILLO</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={imgBrightness}
                onChange={(e) => setImgBrightness(Number(e.target.value))}
              />
              <label className="text-xs text-slate-200">CONTRASTE</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={imgContrast}
                onChange={(e) => setImgContrast(Number(e.target.value))}
              />
              <label className="text-xs text-slate-200">SATURACIÓN</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={imgSaturate}
                onChange={(e) => setImgSaturate(Number(e.target.value))}
              />
              <label className="text-xs text-slate-200">NITIDEZ</label>
              <input
                type="range"
                min="0"
                max="6"
                step="0.2"
                value={imgSharpness}
                onChange={(e) => setImgSharpness(Number(e.target.value))}
              />
              <button
                onClick={() => {
                  setImgZoom(1);
                  setImgBrightness(1);
                  setImgContrast(1);
                  setImgSaturate(1);
                  setImgSharpness(0);
                }}
                className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded"
              >
                RESET
              </button>
              <button
                onClick={() => setSelectedImage(null)}
                className="ml-auto px-2 py-1 text-xs bg-red-500/20 text-red-300 rounded"
              >
                CERRAR
              </button>
            </div>
            <div className="flex-1 rounded border border-white/10 bg-black/70 overflow-auto flex items-center justify-center">
              <img
                src={selectedImage}
                alt="EVIDENCIA HD"
                style={imageFilterStyle}
                className="max-w-full max-h-full object-contain transition-all duration-100"
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-cyan-400/15 bg-slate-950/85 flex flex-wrap gap-2 flex-shrink-0">
        {expedient.state === 'DETECTED' && (
          <button
            onClick={() => handleTransition('review')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-3 py-2 bg-cyan-500/12 border border-cyan-400/35 text-cyan-200 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:bg-cyan-500/20 transition-all disabled:opacity-40"
          >
            Revisar
          </button>
        )}
        {expedient.state === 'UNDER_REVIEW' && (
          <button
            onClick={() => handleTransition('validate')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-3 py-2 bg-emerald-500/12 border border-emerald-400/30 text-emerald-200 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:bg-emerald-500/22 transition-all disabled:opacity-40"
          >
            Validar
          </button>
        )}
        {expedient.state === 'UNDER_REVIEW' && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-3 py-2 bg-red-500/12 border border-red-400/30 text-red-200 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:bg-red-500/22 transition-all disabled:opacity-40"
          >
            Rechazar
          </button>
        )}
        {expedient.state === 'VALIDATED' && currentUser.role === 'SUPERVISOR' && (
          <button
            onClick={() => handleTransition('sign')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-3 py-2 bg-amber-500/12 border border-amber-400/30 text-amber-200 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:bg-amber-500/22 transition-all disabled:opacity-40"
          >
            Firmar
          </button>
        )}
        {expedient.state === 'SIGNED' && (
          <button
            onClick={() => handleTransition('export')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-3 py-2 bg-indigo-500/12 border border-indigo-400/30 text-indigo-200 rounded-lg text-[11px] font-semibold uppercase tracking-wide hover:bg-indigo-500/22 transition-all disabled:opacity-40"
          >
            Exportar
          </button>
        )}
      </div>
    </div>
  );
};
