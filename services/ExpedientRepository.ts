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

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Create new expedient
   */
  async create(expedient: Expedient): Promise<Expedient | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert([
          {
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
          },
        ])
        .select();

      if (error) {
        logger.error('EXPEDIENT_REPO', 'Failed to create expedient', error);
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
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
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

          // Metadatos operacionales
          operator: expedient.operator,
          supervisor: expedient.supervisor,
          signature_is_signed: expedient.signature.isSigned,
          signature_signed_by: expedient.signature.signedBy,
          signature_hash: expedient.signature.signatureHash,
          state_history: JSON.stringify(expedient.stateHistory),
          audit_log: JSON.stringify(expedient.auditLog),
          dpia_certified: expedient.dpiaCertified,
          data_retention_days: expedient.dataRetentionDays,
        })
        .eq('id', expedient.id)
        .select()
        .single();

      if (error) {
        logger.error('EXPEDIENT_REPO', 'Failed to update expedient', error);
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
    logger.info('EXPEDIENT_REPO', 'Repository initialized');
  }
  return instance;
}

export function getExpedientRepository(): ExpedientRepository | null {
  return instance;
}
