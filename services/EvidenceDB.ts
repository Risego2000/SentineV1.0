import { InfractionLog } from '../types';
import { supabase } from './supabase';

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
        // TIER 1: IndexedDB is optional - data persists in Supabase
        // Graceful fallback: continue without local cache
        console.warn('[EvidenceDB] IndexedDB unavailable (Electron/private mode) - using Supabase only');
        this.db = null;
        this.initPromise = null;
        resolve(); // Don't reject - continue without local cache
      };
    });

    return this.initPromise;
  }

  async saveEvidence(
    id: string,
    data: {
      snapshots: string[];
      contextSnapshots?: string[];
      contextHash?: string;
      zoomSnapshots?: string[];
      zoomHash?: string;
      ocrResults?: string[];
      ocrCandidates?: any[];
      ocrValidationReport?: string;
      clip?: string;
    }
  ): Promise<void> {
    if (!this.db) await this.init();

    // TIER 1: If IndexedDB unavailable, skip local cache (Supabase is primary)
    if (!this.db) {
      console.warn('[EvidenceDB] Skipping local cache - IndexedDB unavailable');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ id, ...data, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('[EvidenceDB] Failed to save evidence locally');
        resolve(); // Don't reject - local cache is optional
      };
    });
  }

  async getEvidence(id: string): Promise<{
    snapshots: string[];
    contextSnapshots?: string[];
    contextHash?: string;
    zoomSnapshots?: string[];
    zoomHash?: string;
    ocrResults?: string[];
    ocrCandidates?: any[];
    ocrValidationReport?: string;
    clip?: string;
  } | null> {
    if (!this.db) await this.init();

    // TIER 1: If IndexedDB unavailable, return null (no local cache)
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.warn('[EvidenceDB] Failed to get evidence from local cache');
        resolve(null); // Return null instead of rejecting
      };
    });
  }

  async deleteEvidence(id: string): Promise<void> {
    if (!this.db) await this.init();

    // TIER 1: If IndexedDB unavailable, skip deletion (no local cache)
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('[EvidenceDB] Failed to delete evidence from local cache');
        resolve(); // Don't reject
      };
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

  async saveInfraction(log: InfractionLog): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readwrite');
      const store = transaction.objectStore(this.logStoreName);
      const record = { ...log, synced: false };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_SAVE_INFRACTION'));
    });
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
          const { error } = await supabase.from('incidents').insert({
            plate: infraction.plate,
            make_model: infraction.makeModel,
            color: infraction.color,
            severity: infraction.severity,
            description: infraction.description,
            rule_category: infraction.ruleCategory,
            legal_base: infraction.legalBase,
            reasoning: infraction.reasoning,
            visual_timestamp: infraction.visualTimestamp,
            video_time_code: infraction.videoTimeCode,
            local_time: infraction.localTime,
            image: infraction.image,
            extra_snapshots: infraction.extraSnapshots,
            zoom_snapshots: infraction.zoomSnapshots,
            ocr_results: infraction.ocrResults,
            plate_ocr: infraction.plateOcr,
            video_clip: infraction.videoClip,
            time: infraction.time,
            validation_status: 'pending',
          });

          if (!error) {
            await this.markInfractionSynced(infraction.id);
            synced++;
          } else {
            console.error('[Supabase Sync] Insert failed:', error);
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

export const evidenceDB = new EvidenceDB();
