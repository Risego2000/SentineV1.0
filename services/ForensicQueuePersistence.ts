/**
 * ForensicQueuePersistence - IndexedDB-based persistence for forensic audit jobs
 * Enables queue recovery after browser refresh or crash
 */

import { AuditJob } from '../types/auditJob';

interface PersistedQueueItem {
  job: AuditJob;
  evidenceId: string;
  resolvedAt?: number;
  currentStatus: AuditJob['status'];
  retries: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
}

export class ForensicQueuePersistence {
  private dbName = 'sentinel_forensic_queue';
  private storeName = 'queue_items';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private unavailable = false;

  constructor() {
    this.init();
  }

  private init(): Promise<void> {
    if (this.unavailable) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'job.id' });
          store.createIndex('status', 'currentStatus', { unique: false });
          store.createIndex('retries', 'retries', { unique: false });
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        this.initPromise = null;
        this.db = null;
        this.unavailable = true;
        resolve();
      };
    });

    return this.initPromise;
  }

  async saveQueueItems(items: PersistedQueueItem[]): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Clear existing items first
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        // Add all items
        items.forEach((item) => {
          store.add(item);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('FAILED_TO_SAVE_QUEUE'));
      };

      clearRequest.onerror = () => reject(new Error('FAILED_TO_CLEAR_QUEUE'));
    });
  }

  async loadQueueItems(): Promise<PersistedQueueItem[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as PersistedQueueItem[];
        // Filter out expired items (older than 24 hours) and jobs with max retries exceeded
        const now = Date.now();
        const validItems = items.filter((item) => {
          const age = now - (item.job.createdAt || 0);
          const isExpired = age > 24 * 60 * 60 * 1000; // 24 hours
          const maxRetriesExceeded = item.retries > 5;
          return !isExpired && !maxRetriesExceeded;
        });
        resolve(validItems);
      };

      request.onerror = () => reject(new Error('FAILED_TO_LOAD_QUEUE'));
    });
  }

  async deleteQueueItem(jobId: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(jobId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_DELETE_QUEUE_ITEM'));
    });
  }

  async updateQueueItem(item: PersistedQueueItem): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_UPDATE_QUEUE_ITEM'));
    });
  }

  async clearQueue(): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('FAILED_TO_CLEAR_QUEUE'));
    });
  }

  /**
   * Cleanup old/failed jobs (older than 24 hours or exceeded max retries)
   */
  async cleanupExpiredJobs(): Promise<number> {
    if (!this.db) await this.init();
    if (!this.db) return 0;

    const items = await this.loadQueueItems();
    const now = Date.now();
    let deletedCount = 0;

    for (const item of items) {
      const age = now - (item.job.createdAt || 0);
      const isExpired = age > 24 * 60 * 60 * 1000; // 24 hours
      const maxRetriesExceeded = item.retries > 5;

      if (isExpired || maxRetriesExceeded) {
        await this.deleteQueueItem(item.job.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const forensicQueuePersistence = new ForensicQueuePersistence();
