import { InfractionLog } from '../types';
import { supabase, isSupabaseConfigured, SUPABASE_TABLES } from './supabase';

const getExpedienteNum = (infractionDate: Date): string => {
  const year = infractionDate.getFullYear();
  const month = String(infractionDate.getMonth() + 1).padStart(2, '0');
  const day = String(infractionDate.getDate()).padStart(2, '0');
  const key = `sentinel_exp_${year}_${month}_${day}`;
  const current = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(current));
  return `${year}/${month}/${day}/${String(current).padStart(3, '0')}`;
};

/**
 * EvidenceDB - Persistent Local Storage for Tactical Evidence
 * Uses IndexedDB to store snapshots and clips without affecting React state performance.
 */
export class EvidenceDB {
  private dbName = 'sentinel_evidence_v2';
  private storeName = 'evidences';
  private logStoreName = 'infractions';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 4);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const evidenceStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          evidenceStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const evidenceStore = tx.objectStore(this.storeName);
          if (!evidenceStore.indexNames.contains('timestamp')) {
            evidenceStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        }

        if (!db.objectStoreNames.contains(this.logStoreName)) {
          const logStore = db.createObjectStore(this.logStoreName, { keyPath: 'id' });
          logStore.createIndex('synced', 'synced', { unique: false });
        } else {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const logStore = tx.objectStore(this.logStoreName);
          if (!logStore.indexNames.contains('synced')) {
            logStore.createIndex('synced', 'synced', { unique: false });
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        this.initPromise = null;
        reject(new Error('FAILED_TO_OPEN_INDEXED_DB'));
      };
    });

    return this.initPromise;
  }

  async saveEvidence(
    id: string,
    data: {
      snapshots: string[];
      contextSnapshots?: string[];
      zoomSnapshots?: string[];
      ocrResults?: string[];
      clip?: string;
    }
  ): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ id, ...data, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_SAVE_EVIDENCE'));
    });
  }

  async getEvidence(id: string): Promise<{
    snapshots: string[];
    contextSnapshots?: string[];
    zoomSnapshots?: string[];
    ocrResults?: string[];
    clip?: string;
  } | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('FAILED_TO_GET_EVIDENCE'));
    });
  }

  async deleteEvidence(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_DELETE_EVIDENCE'));
    });
  }

  /**
   * Cleans up evidence older than 24 hours using the timestamp index
   * (O(log n) range scan instead of a full-table cursor).
   */
  async purgeOldEvidence(): Promise<void> {
    if (!this.db) await this.init();
    const expiration = Date.now() - 24 * 60 * 60 * 1000;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Use the timestamp index for an efficient keyed range query
      const index = store.indexNames.contains('timestamp') ? store.index('timestamp') : null;

      const range = IDBKeyRange.upperBound(expiration);
      const request = index ? index.openCursor(range) : store.openCursor(); // fallback for stores without the index yet

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (!index || cursor.value.timestamp < expiration) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve(); // non-fatal
    });
  }

  private parseInfractionDate(localTime: string): Date {
    const match = localTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
    return new Date();
  }

  async saveInfraction(log: InfractionLog): Promise<void> {
    if (!this.db) await this.init();

    const infractionDate = this.parseInfractionDate(log.localTime || log.time);
    const expedienteNum = getExpedienteNum(infractionDate);

    const logWithExpediente: InfractionLog = {
      ...log,
      expedienteNum,
    };

    // Save locally first for offline support
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readwrite');
      const store = transaction.objectStore(this.logStoreName);
      const record = { ...logWithExpediente, synced: false };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_SAVE_INFRACTION'));
    });

    // Sync immediately to Supabase (not just proactively)
    if (isSupabaseConfigured) {
      await this.syncInfractionToSupabase(logWithExpediente);
    }
  }

  private buildStorageExtraData(infraction: InfractionLog) {
    return {
      reportPath: infraction.reportPath || null,
      generalImagePaths: infraction.generalImagePaths || [],
      detailImagePaths: infraction.detailImagePaths || [],
      videoPath: infraction.videoPath || null,
      storageFolder: infraction.storageFolder || null,
    };
  }

  // Sync single infraction immediately to Supabase
  private async syncInfractionToSupabase(infraction: InfractionLog): Promise<boolean> {
    try {
      const auditResultData = {
        plate: infraction.plate,
        makeModel: infraction.makeModel,
        color: infraction.color,
        description: infraction.description,
        severity: infraction.severity,
        ruleCategory: infraction.ruleCategory,
        legalBase: infraction.legalBase,
        reasoning: infraction.reasoning,
        visualTimestamp: infraction.visualTimestamp,
        videoTimeCode: infraction.videoTimeCode,
        localTime: infraction.localTime,
        telemetry: infraction.telemetry,
      };

      const storageExtraData = this.buildStorageExtraData(infraction);

      const { error: errorInfractions } = await supabase.from(SUPABASE_TABLES.INFRACTIONS).insert({
        status: 'completed',
        expediente_num: infraction.expedienteNum,
        plate: infraction.plate,
        make_model: infraction.makeModel,
        color: infraction.color,
        description: infraction.description,
        severity: infraction.severity,
        rule_category: infraction.ruleCategory,
        legal_base: infraction.legalBase,
        audit_result: auditResultData,
        reasoning: infraction.reasoning,
        visual_timestamp: infraction.visualTimestamp,
        video_time_code: infraction.videoTimeCode,
        local_time: infraction.localTime,
        time: infraction.time,
        playback_time: infraction.playbackTime,
        image_url: infraction.image,
        extra_snapshots: infraction.extraSnapshots,
        zoom_snapshots: infraction.zoomSnapshots,
        ocr_results: infraction.ocrResults,
        plate_ocr: infraction.plateOcr,
        plate_ocr_candidates: infraction.plateOcrCandidates,
        video_clip_url: infraction.videoClip,
        telemetry: infraction.telemetry,
        roi_history: infraction.roiHistory,
        viewer_id: infraction.viewerId,
        validation_status: 'pending',
        infraction_location: infraction.infractionLocation,
        report_path: infraction.reportPath,
        report_generated_at: infraction.reportPath ? new Date().toISOString() : null,
        extra_data: storageExtraData,
      });

      // Also sync to incidents for backward compatibility
      const { error: errorIncidents } = await supabase.from(SUPABASE_TABLES.INCIDENTS).insert({
        status: 'completed',
        expediente_num: infraction.expedienteNum,
        plate: infraction.plate,
        make_model: infraction.makeModel,
        color: infraction.color,
        description: infraction.description,
        severity: infraction.severity,
        rule_category: infraction.ruleCategory,
        legal_base: infraction.legalBase,
        audit_result: auditResultData,
        reasoning: infraction.reasoning,
        visual_timestamp: infraction.visualTimestamp,
        video_time_code: infraction.videoTimeCode,
        local_time: infraction.localTime,
        time: infraction.time,
        playback_time: infraction.playbackTime,
        image_url: infraction.image,
        extra_snapshots: infraction.extraSnapshots,
        zoom_snapshots: infraction.zoomSnapshots,
        ocr_results: infraction.ocrResults,
        plate_ocr: infraction.plateOcr,
        video_clip_url: infraction.videoClip,
        telemetry: infraction.telemetry,
        roi_history: infraction.roiHistory,
        viewer_id: infraction.viewerId,
        validation_status: 'pending',
        infraction_location: infraction.infractionLocation,
        report_path: infraction.reportPath,
        report_generated_at: infraction.reportPath ? new Date().toISOString() : null,
        extra_data: storageExtraData,
      });

      if (!errorInfractions && !errorIncidents) {
        await this.markInfractionSynced(infraction.id);
        console.log(
          '[EvidenceDB] Infraction synced to Supabase:',
          infraction.plate,
          'Expediente:',
          infraction.expedienteNum
        );
        return true;
      }

      console.error('[EvidenceDB] Sync failed:', errorInfractions || errorIncidents);
      return false;
    } catch (err) {
      console.error('[EvidenceDB] Error syncing to Supabase:', err);
      return false;
    }
  }

  async syncUnsyncedInfractions(): Promise<InfractionLog[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readonly');
      const store = transaction.objectStore(this.logStoreName);

      let index: IDBIndex | null = null;
      try {
        index = store.index('synced');
      } catch {
        // Index not available, fallback to full scan
      }

      if (!index) {
        const request = store.getAll();
        request.onsuccess = () => {
          const results = request.result as (InfractionLog & { synced?: boolean })[];
          resolve(results.filter((i) => !i.synced));
        };
        request.onerror = () => reject(new Error('FAILED_TO_GET_UNSYNCED_INFRACTIONS'));
        return;
      }

      const range = IDBKeyRange.only(false);
      const request = index.getAll(range);
      request.onsuccess = () => resolve((request.result as InfractionLog[]) || []);
      request.onerror = () => reject(new Error('FAILED_TO_GET_UNSYNCED_INFRACTIONS'));
    });
  }

  async markInfractionSynced(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readwrite');
      const store = transaction.objectStore(this.logStoreName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.synced = true;
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('FAILED_TO_MARK_SYNCED'));
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(new Error('FAILED_TO_MARK_SYNCED'));
    });
  }

  async syncToSupabase(): Promise<{ synced: number; failed: number }> {
    try {
      const unsynced = await this.syncUnsyncedInfractions();
      let synced = 0;
      let failed = 0;

      for (const infraction of unsynced) {
        try {
          const auditResultData = {
            plate: infraction.plate,
            makeModel: infraction.makeModel,
            color: infraction.color,
            description: infraction.description,
            severity: infraction.severity,
            ruleCategory: infraction.ruleCategory,
            legalBase: infraction.legalBase,
            reasoning: infraction.reasoning,
            visualTimestamp: infraction.visualTimestamp,
            videoTimeCode: infraction.videoTimeCode,
            localTime: infraction.localTime,
            telemetry: infraction.telemetry,
          };

          const storageExtraData = this.buildStorageExtraData(infraction);

          const { error: errorInfractions } = await supabase
            .from(SUPABASE_TABLES.INFRACTIONS)
            .insert({
              status: 'completed',
              expediente_num: infraction.expedienteNum,
              plate: infraction.plate,
              make_model: infraction.makeModel,
              color: infraction.color,
              severity: infraction.severity,
              description: infraction.description,
              rule_category: infraction.ruleCategory,
              legal_base: infraction.legalBase,
              audit_result: auditResultData,
              reasoning: infraction.reasoning,
              visual_timestamp: infraction.visualTimestamp,
              video_time_code: infraction.videoTimeCode,
              local_time: infraction.localTime,
              time: infraction.time,
              playback_time: infraction.playbackTime,
              image_url: infraction.image,
              extra_snapshots: infraction.extraSnapshots,
              zoom_snapshots: infraction.zoomSnapshots,
              ocr_results: infraction.ocrResults,
              plate_ocr: infraction.plateOcr,
              plate_ocr_candidates: infraction.plateOcrCandidates,
              video_clip_url: infraction.videoClip,
              telemetry: infraction.telemetry,
              roi_history: infraction.roiHistory,
              viewer_id: infraction.viewerId,
              infraction_location: infraction.infractionLocation,
              validation_status: 'pendiente',
              report_path: infraction.reportPath,
              report_generated_at: infraction.reportPath ? new Date().toISOString() : null,
              extra_data: storageExtraData,
            });

          const { error: errorIncidents } = await supabase.from(SUPABASE_TABLES.INCIDENTS).insert({
            status: 'completed',
            expediente_num: infraction.expedienteNum,
            plate: infraction.plate,
            make_model: infraction.makeModel,
            color: infraction.color,
            severity: infraction.severity,
            description: infraction.description,
            rule_category: infraction.ruleCategory,
            legal_base: infraction.legalBase,
            audit_result: auditResultData,
            reasoning: infraction.reasoning,
            visual_timestamp: infraction.visualTimestamp,
            video_time_code: infraction.videoTimeCode,
            local_time: infraction.localTime,
            time: infraction.time,
            playback_time: infraction.playbackTime,
            image_url: infraction.image,
            extra_snapshots: infraction.extraSnapshots,
            zoom_snapshots: infraction.zoomSnapshots,
            ocr_results: infraction.ocrResults,
            plate_ocr: infraction.plateOcr,
            plate_ocr_candidates: infraction.plateOcrCandidates,
            video_clip_url: infraction.videoClip,
            telemetry: infraction.telemetry,
            roi_history: infraction.roiHistory,
            viewer_id: infraction.viewerId,
            infraction_location: infraction.infractionLocation,
            validation_status: 'pending',
            report_path: infraction.reportPath,
            report_generated_at: infraction.reportPath ? new Date().toISOString() : null,
            extra_data: storageExtraData,
          });

          if (!errorInfractions || !errorIncidents) {
            await this.markInfractionSynced(infraction.id);
            synced++;
          } else {
            console.error('[Supabase Sync] Insert failed:', errorInfractions);
            failed++;
          }
        } catch (err) {
          console.error('[Supabase Sync] Error syncing infraction:', err);
          failed++;
        }
      }

      return { synced, failed };
    } catch {
      return { synced: 0, failed: 0 };
    }
  }

  async getAllInfractions(): Promise<InfractionLog[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readonly');
      const store = transaction.objectStore(this.logStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as InfractionLog[]) || []);
      request.onerror = () => reject(new Error('FAILED_TO_GET_INFRACTIONS'));
    });
  }

  async deleteInfraction(id: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readwrite');
      const store = transaction.objectStore(this.logStoreName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_DELETE_INFRACTION'));
    });
  }
}

export interface LugarInfraccion {
  id?: string;
  nombre: string;
  descripcion?: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
  tipo_via?: string;
  coordenadas?: { lat: number; lng: number };
  activo?: boolean;
  orden?: number;
  metadata?: Record<string, unknown>;
  operator_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const evidenceDB = new EvidenceDB();

export async function getLugaresFromSupabase(): Promise<LugarInfraccion[]> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('sentinel_lugares_infraccion');
    return saved ? JSON.parse(saved) : [];
  }
  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.LUGARES_INFRACCION)
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (error) {
      console.error('[EvidenceDB] Error fetching lugares:', error);
      return [];
    }
    if (data && data.length > 0) {
      localStorage.setItem('sentinel_lugares_infraccion', JSON.stringify(data));
    }
    return data || [];
  } catch (err) {
    console.error('[EvidenceDB] Error getting lugares:', err);
    return [];
  }
}

export async function saveLugarToSupabase(lugar: LugarInfraccion): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('sentinel_lugares_infraccion');
    const lugares: LugarInfraccion[] = saved ? JSON.parse(saved) : [];
    lugares.push({ ...lugar, id: lugar.id || crypto.randomUUID() });
    localStorage.setItem('sentinel_lugares_infraccion', JSON.stringify(lugares));
    return true;
  }
  try {
    const { error } = await supabase.from(SUPABASE_TABLES.LUGARES_INFRACCION).insert({
      nombre: lugar.nombre,
      descripcion: lugar.descripcion,
      direccion: lugar.direccion,
      municipio: lugar.municipio || 'Daganzo de Arriba',
      provincia: lugar.provincia || 'Madrid',
      tipo_via: lugar.tipo_via || 'urbana',
      coordenadas: lugar.coordenadas ? JSON.stringify(lugar.coordenadas) : {},
      activo: true,
      orden: lugar.orden || 0,
      metadata: lugar.metadata || {},
      operator_id: lugar.operator_id,
    });
    if (error) {
      console.error('[EvidenceDB] Error saving lugar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EvidenceDB] Error saving lugar:', err);
    return false;
  }
}

export async function deleteLugarFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('sentinel_lugares_infraccion');
    const lugares: LugarInfraccion[] = saved ? JSON.parse(saved) : [];
    const filtered = lugares.filter((l) => l.id !== id);
    localStorage.setItem('sentinel_lugares_infraccion', JSON.stringify(filtered));
    return true;
  }
  try {
    const { error } = await supabase.from(SUPABASE_TABLES.LUGARES_INFRACCION).delete().eq('id', id);
    if (error) {
      console.error('[EvidenceDB] Error deleting lugar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EvidenceDB] Error deleting lugar:', err);
    return false;
  }
}

export async function updateLugarToSupabase(lugar: LugarInfraccion): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('sentinel_lugares_infraccion');
    const lugares: LugarInfraccion[] = saved ? JSON.parse(saved) : [];
    const index = lugares.findIndex((l) => l.id === lugar.id);
    if (index !== -1) {
      lugares[index] = lugar;
      localStorage.setItem('sentinel_lugares_infraccion', JSON.stringify(lugares));
      return true;
    }
    return false;
  }
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.LUGARES_INFRACCION)
      .update({
        nombre: lugar.nombre,
        descripcion: lugar.descripcion,
        direccion: lugar.direccion,
        municipio: lugar.municipio,
        provincia: lugar.provincia,
        tipo_via: lugar.tipo_via,
        coordenadas: lugar.coordenadas ? JSON.stringify(lugar.coordenadas) : {},
        orden: lugar.orden,
        metadata: lugar.metadata,
      })
      .eq('id', lugar.id);
    if (error) {
      console.error('[EvidenceDB] Error updating lugar:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EvidenceDB] Error updating lugar:', err);
    return false;
  }
}
