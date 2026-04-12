import { InfractionLog } from '../types';

/**
 * EvidenceDB - Persistent Local Storage for Tactical Evidence
 * Uses IndexedDB to store snapshots and clips without affecting React state performance.
 */
export class EvidenceDB {
  private dbName = 'sentinel_evidence_v1';
  private storeName = 'evidences';
  private logStoreName = 'infractions';
  private db: IDBDatabase | null = null;

  constructor() {
    this.init();
  }

  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.logStoreName)) {
          db.createObjectStore(this.logStoreName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(new Error('FAILED_TO_OPEN_INDEXED_DB'));
    });
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
   * Cleans up evidence older than 24 hours to prevent disk bloat.
   */
  async purgeOldEvidence(): Promise<void> {
    if (!this.db) await this.init();
    const expiration = Date.now() - 24 * 60 * 60 * 1000;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.timestamp < expiration) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  async saveInfraction(log: InfractionLog): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.logStoreName], 'readwrite');
      const store = transaction.objectStore(this.logStoreName);
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_SAVE_INFRACTION'));
    });
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
