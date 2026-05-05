/**
 * Expedient Repository - TIER 1
 * Database layer for expedient persistence in Supabase
 */

import { Expedient } from '../domain/Expedient';
import { logger } from './logger';

export interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getSession: () => Promise<any>;
  };
}

/**
 * Expedient Repository - Supabase persistence
 */
export class ExpedientRepository {
  private supabase: SupabaseClient;
  private tableName = 'expedients';
  private remotePersistenceDisabled = false;
  private remoteDisableReason = '';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    try {
      const persisted =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('sentinel_remote_expedients_disabled')
          : null;
      if (persisted) {
        this.remotePersistenceDisabled = true;
        this.remoteDisableReason = persisted;
      }
    } catch {
      // ignore storage access issues
    }
  }

  private shouldDisableRemotePersistence(error: any): boolean {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    // Schema/cache mismatch, FK mismatch, or permissions mismatch are not recoverable client-side.
    return (
      code === 'PGRST204' ||
      code === '23503' ||
      code === '42501' ||
      message.includes('schema cache') ||
      message.includes('violates foreign key') ||
      message.includes('row-level security')
    );
  }

  private disableRemotePersistence(error: any): void {
    if (this.remotePersistenceDisabled) return;
    this.remotePersistenceDisabled = true;
    this.remoteDisableReason = `${error?.code || 'UNKNOWN'}: ${error?.message || 'remote schema/policy issue'}`;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'sentinel_remote_expedients_disabled',
          this.remoteDisableReason
        );
      }
    } catch {
      // ignore storage access issues
    }
    logger.warn(
      'EXPEDIENT_REPO',
      `Remote persistence disabled for session (${this.remoteDisableReason}). Local flow continues.`
    );
  }

  /**
   * Create new expedient
   */
  async create(expedient: Expedient): Promise<Expedient | null> {
    try {
      if (this.remotePersistenceDisabled) {
        return expedient;
      }
      const session = await this.supabase.auth.getSession();
      const authUid = session?.data?.session?.user?.id || null;
      const fullPayload = {
        // Identificación
        id: expedient.id,
        infraction_id: expedient.infractionId,
        created_at: new Date(expedient.createdAt).toISOString(),
        updated_at: new Date(expedient.updatedAt).toISOString(),
        state: expedient.state,

        // Información del caso
        violation_type: expedient.violationType,
        location: expedient.location,
        timestamp: new Date(expedient.timestamp).toISOString(),
        license_plate: expedient.licensePlate,
        vehicle_description: expedient.vehicleDescription,

        // Datos del lugar
        via: expedient.via,
        numero_punto_kilometrico: expedient.numeroPuntoKilometrico,
        municipio: expedient.municipio,
        provincia: expedient.provincia,
        latitud: expedient.latitud,
        longitud: expedient.longitud,
        gravedad: expedient.gravedad,
        norma_conducta_nombre: expedient.normaConductaNombre,
        norma_conducta_abreviatura: expedient.normaConductaAbreviatura,
        articulo_conducta: expedient.articuloConducta,
        articulo_conducta_texto: expedient.articuloConductaTexto,
        norma_sancionadora_nombre: expedient.normaSancionadoraNombre,
        norma_sancionadora_abreviatura: expedient.normaSancionadoraAbreviatura,
        articulo_sancionador: expedient.articuloSancionador,
        articulo_sancionador_texto: expedient.articuloSancionadorTexto,
        codigo_senal: expedient.codigoSenal,
        descripcion_senal: expedient.descripcionSenal,
        definicion_infraccion: expedient.definicionInfraccion,
        conducta_denunciada: expedient.conductaDenunciada,
        sancion_euros: expedient.sancionEuros,
        puntos_detraccion: expedient.puntosDetraccion,
        riesgo_nivel: expedient.riesgoNivel,

        // Datos del vehículo
        marca: expedient.marca,
        modelo: expedient.modelo,
        color: expedient.color,
        numero_chasis: expedient.numeroChasis,
        estado_itv: expedient.estadoITV,
        seguro_obligatorio: expedient.seguroObligatorio,

        // Datos del titular
        titular_nombre: expedient.titularNombre,
        titular_dni: expedient.titularDNI,
        titular_domicilio: expedient.titularDomicilio,
        titular_localidad: expedient.titularLocalidad,
        titular_provincia: expedient.titularProvincia,
        titular_telefono: expedient.titularTelefono,
        titular_email: expedient.titularEmail,

        // Datos del conductor
        conductor_nombre: expedient.conductorNombre,
        conductor_dni: expedient.conductorDNI,
        conductor_permiso: expedient.conductorPermiso,
        conductor_clase: expedient.conductorClase,
        conductor_domicilio: expedient.conductorDomicilio,
        conductor_localidad: expedient.conductorLocalidad,
        conductor_provincia: expedient.conductorProvincia,
        conductor_telefono: expedient.conductorTelefono,
        conductor_email: expedient.conductorEmail,

        // Descripción de hechos
        descripcion_detallada_hechos: expedient.descripcionDetalladaHechos,
        circunstancias_agravantes: expedient.circunstanciasAgravantes,

        // Evidencia
        evidence_id: expedient.evidenceId,
        photos_count: expedient.photosCount,
        video_clip_hash: expedient.videoClipHash,

        // Metadatos
        operator: expedient.operator,
        supervisor: expedient.supervisor,
        signature_is_signed: expedient.signature.isSigned,
        signature_signed_by: expedient.signature.signedBy,
        signature_hash: expedient.signature.signatureHash,
        state_history: JSON.stringify(expedient.stateHistory),
        audit_log: JSON.stringify(expedient.auditLog),
        dpia_certified: expedient.dpiaCertified,
        data_retention_days: expedient.dataRetentionDays,
        custody_last_checked_at: expedient.custodyLastCheckedAt
          ? new Date(expedient.custodyLastCheckedAt).toISOString()
          : null,
        custody_last_status: expedient.custodyLastStatus || null,
        custody_last_summary: expedient.custodyLastSummary || null,
        custody_verification_rows: expedient.custodyVerificationRows || null,
        operator_id: authUid,
      };

      const payloadTiers: Record<string, any>[] = [
        {
          id: expedient.id,
          infraction_id: expedient.infractionId,
          created_at: new Date(expedient.createdAt).toISOString(),
          updated_at: new Date(expedient.updatedAt).toISOString(),
          state: expedient.state,
          violation_type: expedient.violationType,
          location: expedient.location,
          timestamp: new Date(expedient.timestamp).toISOString(),
          license_plate: expedient.licensePlate,
          vehicle_description: expedient.vehicleDescription,
          evidence_id: expedient.evidenceId,
          operator: expedient.operator,
          supervisor: expedient.supervisor,
          signature_is_signed: expedient.signature.isSigned,
          state_history: JSON.stringify(expedient.stateHistory),
          audit_log: JSON.stringify(expedient.auditLog),
          ...(authUid ? { operator_id: authUid } : {}),
        },
        {
          id: expedient.id,
          infraction_id: expedient.infractionId,
          state: expedient.state,
          ...(authUid ? { operator_id: authUid } : {}),
        },
        fullPayload,
      ];

      let created = false;
      for (let i = 0; i < payloadTiers.length; i += 1) {
        const attempt = await this.supabase.from(this.tableName).insert([payloadTiers[i]]);
        if (!attempt.error) {
          created = true;
          if (i > 0) logger.warn('EXPEDIENT_REPO', `Create succeeded with fallback tier ${i + 1}`);
          break;
        }
        logger.warn(
          'EXPEDIENT_REPO',
          `Create tier ${i + 1} failed, trying next payload tier`,
          attempt.error
        );
        if (this.shouldDisableRemotePersistence(attempt.error)) {
          this.disableRemotePersistence(attempt.error);
          return expedient;
        }
      }
      if (!created) {
        logger.error('EXPEDIENT_REPO', 'Failed to create expedient after all fallback tiers');
        return null;
      }

      logger.info('EXPEDIENT_REPO', `Created expedient ${expedient.id}`);
      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'Create error', error);
      return null;
    }
  }

  /**
   * Get expedient by ID
   */
  async getById(id: string): Promise<Expedient | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.warn('EXPEDIENT_REPO', `Expedient not found: ${id}`);
        return null;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'Get error', error);
      return null;
    }
  }

  /**
   * Update expedient
   */
  async update(expedient: Expedient): Promise<Expedient | null> {
    try {
      if (this.remotePersistenceDisabled) {
        return expedient;
      }
      const session = await this.supabase.auth.getSession();
      const authUid = session?.data?.session?.user?.id || null;
      const fullUpdate: Record<string, any> = {
        updated_at: new Date(expedient.updatedAt).toISOString(),
        state: expedient.state,
        violation_type: expedient.violationType,
        location: expedient.location,
        timestamp: new Date(expedient.timestamp).toISOString(),
        license_plate: expedient.licensePlate,
        vehicle_description: expedient.vehicleDescription,
        via: expedient.via,
        numero_punto_kilometrico: expedient.numeroPuntoKilometrico,
        municipio: expedient.municipio,
        provincia: expedient.provincia,
        latitud: expedient.latitud,
        longitud: expedient.longitud,
        gravedad: expedient.gravedad,
        norma_conducta_nombre: expedient.normaConductaNombre,
        norma_conducta_abreviatura: expedient.normaConductaAbreviatura,
        articulo_conducta: expedient.articuloConducta,
        articulo_conducta_texto: expedient.articuloConductaTexto,
        norma_sancionadora_nombre: expedient.normaSancionadoraNombre,
        norma_sancionadora_abreviatura: expedient.normaSancionadoraAbreviatura,
        articulo_sancionador: expedient.articuloSancionador,
        articulo_sancionador_texto: expedient.articuloSancionadorTexto,
        codigo_senal: expedient.codigoSenal,
        descripcion_senal: expedient.descripcionSenal,
        definicion_infraccion: expedient.definicionInfraccion,
        conducta_denunciada: expedient.conductaDenunciada,
        sancion_euros: expedient.sancionEuros,
        puntos_detraccion: expedient.puntosDetraccion,
        riesgo_nivel: expedient.riesgoNivel,
        marca: expedient.marca,
        modelo: expedient.modelo,
        color: expedient.color,
        numero_chasis: expedient.numeroChasis,
        estado_itv: expedient.estadoITV,
        seguro_obligatorio: expedient.seguroObligatorio,
        titular_nombre: expedient.titularNombre,
        titular_dni: expedient.titularDNI,
        titular_domicilio: expedient.titularDomicilio,
        titular_localidad: expedient.titularLocalidad,
        titular_provincia: expedient.titularProvincia,
        titular_telefono: expedient.titularTelefono,
        titular_email: expedient.titularEmail,
        conductor_nombre: expedient.conductorNombre,
        conductor_dni: expedient.conductorDNI,
        conductor_permiso: expedient.conductorPermiso,
        conductor_clase: expedient.conductorClase,
        conductor_domicilio: expedient.conductorDomicilio,
        conductor_localidad: expedient.conductorLocalidad,
        conductor_provincia: expedient.conductorProvincia,
        conductor_telefono: expedient.conductorTelefono,
        conductor_email: expedient.conductorEmail,
        descripcion_detallada_hechos: expedient.descripcionDetalladaHechos,
        circunstancias_agravantes: expedient.circunstanciasAgravantes,
        evidence_id: expedient.evidenceId,
        photos_count: expedient.photosCount,
        video_clip_hash: expedient.videoClipHash,
        operator: expedient.operator,
        supervisor: expedient.supervisor,
        signature_is_signed: expedient.signature.isSigned,
        signature_signed_by: expedient.signature.signedBy,
        signature_hash: expedient.signature.signatureHash,
        state_history: JSON.stringify(expedient.stateHistory),
        audit_log: JSON.stringify(expedient.auditLog),
        dpia_certified: expedient.dpiaCertified,
        data_retention_days: expedient.dataRetentionDays,
        custody_last_checked_at: expedient.custodyLastCheckedAt
          ? new Date(expedient.custodyLastCheckedAt).toISOString()
          : null,
        custody_last_status: expedient.custodyLastStatus || null,
        custody_last_summary: expedient.custodyLastSummary || null,
        custody_verification_rows: expedient.custodyVerificationRows || null,
      };
      if (authUid) fullUpdate.operator_id = authUid;

      const updateTiers: Record<string, any>[] = [
        {
          updated_at: new Date(expedient.updatedAt).toISOString(),
          state: expedient.state,
          infraction_id: expedient.infractionId,
          violation_type: expedient.violationType,
          location: expedient.location,
          timestamp: new Date(expedient.timestamp).toISOString(),
          license_plate: expedient.licensePlate,
          vehicle_description: expedient.vehicleDescription,
          evidence_id: expedient.evidenceId,
          operator: expedient.operator,
          supervisor: expedient.supervisor,
          signature_is_signed: expedient.signature.isSigned,
          state_history: JSON.stringify(expedient.stateHistory),
          audit_log: JSON.stringify(expedient.auditLog),
          ...(authUid ? { operator_id: authUid } : {}),
        },
        {
          updated_at: new Date(expedient.updatedAt).toISOString(),
          state: expedient.state,
          ...(authUid ? { operator_id: authUid } : {}),
        },
        fullUpdate,
      ];

      let updated = false;
      for (let i = 0; i < updateTiers.length; i += 1) {
        const attempt = await this.supabase
          .from(this.tableName)
          .update(updateTiers[i])
          .eq('id', expedient.id);
        if (!attempt.error) {
          updated = true;
          if (i > 0) logger.warn('EXPEDIENT_REPO', `Update succeeded with fallback tier ${i + 1}`);
          break;
        }
        logger.warn(
          'EXPEDIENT_REPO',
          `Update tier ${i + 1} failed, trying next payload tier`,
          attempt.error
        );
        if (this.shouldDisableRemotePersistence(attempt.error)) {
          this.disableRemotePersistence(attempt.error);
          return expedient;
        }
      }
      if (!updated) {
        logger.error('EXPEDIENT_REPO', 'Failed to update expedient after all fallback tiers');
        return null;
      }

      logger.info('EXPEDIENT_REPO', `Updated expedient ${expedient.id}`);
      return expedient;
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'Update error', error);
      return null;
    }
  }

  /**
   * List expedients by state
   */
  async getByState(state: string): Promise<Expedient[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('state', state)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('EXPEDIENT_REPO', `Failed to get expedients by state: ${state}`);
        return [];
      }

      return data.map((row: any) => this.mapFromDatabase(row)).filter((e) => e !== null);
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'getByState error', error);
      return [];
    }
  }

  /**
   * List all expedients
   */
  async getAll(): Promise<Expedient[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('EXPEDIENT_REPO', 'Failed to get all expedients');
        return [];
      }

      return data.map((row: any) => this.mapFromDatabase(row)).filter((e) => e !== null);
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'getAll error', error);
      return [];
    }
  }

  /**
   * Search expedients by license plate
   */
  async searchByPlate(plate: string): Promise<Expedient[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .ilike('license_plate', `%${plate}%`)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('EXPEDIENT_REPO', `Search by plate failed: ${plate}`);
        return [];
      }

      return data.map((row: any) => this.mapFromDatabase(row)).filter((e) => e !== null);
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'searchByPlate error', error);
      return [];
    }
  }

  /**
   * Delete expedient by ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from(this.tableName).delete().eq('id', id);
      if (error) {
        logger.error('EXPEDIENT_REPO', `Failed to delete expedient ${id}`, error);
        return false;
      }
      logger.info('EXPEDIENT_REPO', `Deleted expedient ${id}`);
      return true;
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'deleteById error', error);
      return false;
    }
  }

  /**
   * Get expedients awaiting review
   */
  async getPendingReview(): Promise<Expedient[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('state', ['DETECTED', 'UNDER_REVIEW'])
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('EXPEDIENT_REPO', 'Failed to get pending review');
        return [];
      }

      return data.map((row: any) => this.mapFromDatabase(row)).filter((e) => e !== null);
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'getPendingReview error', error);
      return [];
    }
  }

  /**
   * Map database row to Expedient
   */
  private mapFromDatabase(row: any): Expedient | null {
    try {
      const extraData =
        typeof row.extra_data === 'string'
          ? JSON.parse(row.extra_data || '{}')
          : row.extra_data || {};

      return {
        // Identificación
        id: row.id,
        infractionId: row.infraction_id,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        state: row.state as any,

        // Información del caso
        violationType: row.violation_type as any,
        location: row.location,
        timestamp: new Date(row.timestamp).getTime(),
        vehicleDescription: row.vehicle_description,
        licensePlate: row.license_plate,

        // Datos del lugar
        via: row.via,
        numeroPuntoKilometrico: row.numero_punto_kilometrico,
        municipio: row.municipio,
        provincia: row.provincia,
        latitud: row.latitud,
        longitud: row.longitud,
        gravedad: row.gravedad,
        normaConductaNombre: row.norma_conducta_nombre,
        normaConductaAbreviatura: row.norma_conducta_abreviatura,
        articuloConducta: row.articulo_conducta,
        articuloConductaTexto: row.articulo_conducta_texto,
        normaSancionadoraNombre: row.norma_sancionadora_nombre,
        normaSancionadoraAbreviatura: row.norma_sancionadora_abreviatura,
        articuloSancionador: row.articulo_sancionador,
        articuloSancionadorTexto: row.articulo_sancionador_texto,
        codigoSenal: row.codigo_senal,
        descripcionSenal: row.descripcion_senal,
        definicionInfraccion: row.definicion_infraccion,
        conductaDenunciada: row.conducta_denunciada,
        sancionEuros: row.sancion_euros,
        puntosDetraccion: row.puntos_detraccion,
        riesgoNivel: row.riesgo_nivel,

        // Datos del vehículo
        marca: row.marca,
        modelo: row.modelo,
        color: row.color,
        numeroChasis: row.numero_chasis,
        estadoITV: row.estado_itv,
        seguroObligatorio: row.seguro_obligatorio,

        // Datos del titular
        titularNombre: row.titular_nombre,
        titularDNI: row.titular_dni,
        titularDomicilio: row.titular_domicilio,
        titularLocalidad: row.titular_localidad,
        titularProvincia: row.titular_provincia,
        titularTelefono: row.titular_telefono,
        titularEmail: row.titular_email,

        // Datos del conductor
        conductorNombre: row.conductor_nombre,
        conductorDNI: row.conductor_dni,
        conductorPermiso: row.conductor_permiso,
        conductorClase: row.conductor_clase,
        conductorDomicilio: row.conductor_domicilio,
        conductorLocalidad: row.conductor_localidad,
        conductorProvincia: row.conductor_provincia,
        conductorTelefono: row.conductor_telefono,
        conductorEmail: row.conductor_email,

        // Descripción de hechos
        descripcionDetalladaHechos: row.descripcion_detallada_hechos,
        circunstanciasAgravantes: row.circunstancias_agravantes,

        // Evidencia
        evidenceId: row.evidence_id,
        photosCount: row.photos_count,
        videoClipHash: row.video_clip_hash,
        image: row.image || row.image_data || extraData.image,
        extraSnapshots: row.extra_snapshots || extraData.extraSnapshots,
        zoomSnapshots: row.zoom_snapshots || extraData.zoomSnapshots,
        videoClip: row.video_clip || row.video_clip_url || extraData.videoClip,
        makeModel: row.make_model || extraData.makeModel,
        severity: row.severity || extraData.severity,
        ruleCategory: row.rule_category || extraData.ruleCategory,
        description: row.description || extraData.description,
        legalBase: row.legal_base || extraData.legalBase,
        reasoning: row.reasoning || extraData.reasoning,
        videoTimeCode: row.video_time_code || extraData.videoTimeCode,
        visualTimestamp: row.visual_timestamp || extraData.visualTimestamp,
        ocrResults: row.ocr_results || extraData.ocrResults,
        plateOcr: row.plate_ocr || extraData.plateOcr,
        plateOcrCandidates: row.plate_ocr_candidates || extraData.plateOcrCandidates,
        validationStatus: row.validation_status || extraData.validationStatus,
        playbackTime: row.playback_time || extraData.playbackTime,
        telemetrySpeedEstimated: extraData.telemetrySpeedEstimated,
        telemetryBehaviorAnomalies: extraData.telemetryBehaviorAnomalies,
        operativeCode: row.operative_code || extraData.operativeCode,
        priority: row.priority || extraData.priority,
        priorityLevel: row.priority_level || extraData.priorityLevel,
        fineAmount: row.fine_amount || extraData.fineAmount,
        pointsDeducted: row.points_deducted || extraData.pointsDeducted,

        // Metadatos operacionales
        operator: row.operator,
        supervisor: row.supervisor,
        signature: {
          isSigned: row.signature_is_signed,
          signedBy: row.signature_signed_by,
          signedAt: 0,
          signatureHash: row.signature_hash || '',
          method: 'digital',
        },
        stateHistory: JSON.parse(row.state_history || '[]'),
        auditLog: JSON.parse(row.audit_log || '[]'),
        dpiaCertified: row.dpia_certified,
        dataRetentionDays: row.data_retention_days,
        custodyLastCheckedAt: row.custody_last_checked_at
          ? new Date(row.custody_last_checked_at).getTime()
          : undefined,
        custodyLastStatus: row.custody_last_status || undefined,
        custodyLastSummary: row.custody_last_summary || undefined,
        custodyVerificationRows: row.custody_verification_rows || undefined,
      };
    } catch (error) {
      logger.error('EXPEDIENT_REPO', 'mapFromDatabase error', error);
      return null;
    }
  }
}

// Singleton instance
let instance: ExpedientRepository | null = null;

export function initializeExpedientRepository(supabase: SupabaseClient): ExpedientRepository {
  if (!instance) {
    instance = new ExpedientRepository(supabase);
  }
  return instance;
}

export function getExpedientRepository(): ExpedientRepository | null {
  return instance;
}
