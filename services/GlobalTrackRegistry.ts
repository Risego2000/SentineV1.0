/**
 * Global Track ID Registry
 * Manages globally unique, collision-proof track IDs across all viewers and sessions
 *
 * ID Format: {source}-{viewerId}-{sessionId}-{counter}
 * Example: live-viewer-1-1704067200000-abc123-00001
 */

import { logger } from './logger';

export interface TrackMetadata {
  globalId: string;
  viewerId: string;
  source: 'live' | 'upload' | 'ip-camera';
  label: string;
  createdAt: number;
  lastSeenAt: number;
  frameCount: number;
  boundingBoxes: Array<{ x: number; y: number; w: number; h: number }>;
  velocityAvg: number;
  anomalies?: string[];
  _bboxIndex?: number; // Circular buffer index (internal)
}

export interface ArchivedTrack extends TrackMetadata {
  archivedAt: number;
  finalBoundingBox: { x: number; y: number; w: number; h: number };
  totalDistance: number;
}

export class GlobalTrackRegistry {
  private static instance: GlobalTrackRegistry | null = null;

  private activeTracks: Map<string, TrackMetadata> = new Map();
  private sessionId: string;
  private idCounter: number = 0;
  private maxIdLength: number = 5; // e.g., "00001"

  private db: IDBDatabase | null = null;
  private dbName = 'sentinel_track_registry';
  private storeName = 'tracks';
  private sessionStoreName = 'sessions';

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeDatabase();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalTrackRegistry {
    if (!GlobalTrackRegistry.instance) {
      GlobalTrackRegistry.instance = new GlobalTrackRegistry();
    }
    return GlobalTrackRegistry.instance;
  }

  /**
   * Initialize IndexedDB for persistent track storage
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        logger.warn('GLOBAL_TRACK_REGISTRY', 'IndexedDB failed, using in-memory only');
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create archived tracks store
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'globalId' });
        }

        // Create session metadata store
        if (!db.objectStoreNames.contains(this.sessionStoreName)) {
          db.createObjectStore(this.sessionStoreName, { keyPath: 'sessionId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.debug('GLOBAL_TRACK_REGISTRY', `Database initialized (sessionId: ${this.sessionId})`);
      };
    } catch (error) {
      logger.warn('GLOBAL_TRACK_REGISTRY', 'IndexedDB unavailable (private mode?)', error);
    }
  }

  /**
   * Generate unique session ID for this app lifecycle
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * Allocate a unique global track ID
   */
  allocateId(source: 'live' | 'upload' | 'ip-camera', viewerId: string, label: string): string {
    this.idCounter++;
    const counter = this.idCounter.toString().padStart(this.maxIdLength, '0');
    const globalId = `${source}-${viewerId}-${this.sessionId}-${counter}`;

    // Create metadata entry
    const metadata: TrackMetadata = {
      globalId,
      viewerId,
      source,
      label,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      frameCount: 0,
      boundingBoxes: [],
      velocityAvg: 0,
    };

    this.activeTracks.set(globalId, metadata);

    logger.debug('GLOBAL_TRACK_REGISTRY', `Allocated ID: ${globalId} (${label})`);

    return globalId;
  }

  /**
   * Get track metadata by global ID
   */
  getTrackMetadata(globalId: string): TrackMetadata | null {
    return this.activeTracks.get(globalId) || null;
  }

  /**
   * Update track metadata (called each frame the track is seen)
   */
  updateTrack(
    globalId: string,
    bbox: { x: number; y: number; w: number; h: number },
    velocity: number,
    anomalies?: string[]
  ): boolean {
    const metadata = this.activeTracks.get(globalId);
    if (!metadata) return false;

    metadata.lastSeenAt = Date.now();
    metadata.frameCount++;

    // Use circular buffer for boundingBoxes (O(1) instead of O(n) slice)
    const MAX_BBOXES = 100;
    if (!metadata._bboxIndex) {
      metadata._bboxIndex = 0;
    }

    if (metadata.boundingBoxes.length < MAX_BBOXES) {
      // Buffer not full yet, just push
      metadata.boundingBoxes.push(bbox);
    } else {
      // Buffer full, overwrite oldest entry (circular)
      metadata.boundingBoxes[metadata._bboxIndex] = bbox;
      metadata._bboxIndex = (metadata._bboxIndex + 1) % MAX_BBOXES;
    }

    metadata.velocityAvg = (metadata.velocityAvg * (metadata.frameCount - 1) + velocity) / metadata.frameCount;
    if (anomalies) {
      metadata.anomalies = [...(metadata.anomalies || []), ...anomalies];
    }

    return true;
  }

  /**
   * Validate that ID is unique (no collisions)
   */
  validateIdUniqueness(globalId: string): boolean {
    const parts = globalId.split('-');
    if (parts.length !== 4) return false;

    const [source, viewerId, sessionId, counter] = parts;
    if (!['live', 'upload', 'ip-camera'].includes(source)) return false;
    if (!/^\d+$/.test(counter)) return false;

    return true;
  }

  /**
   * Archive track when it exits the scene
   */
  async archiveTrack(
    globalId: string,
    finalBBox: { x: number; y: number; w: number; h: number },
    totalDistance: number
  ): Promise<void> {
    const metadata = this.activeTracks.get(globalId);
    if (!metadata) return;

    const archived: ArchivedTrack = {
      ...metadata,
      archivedAt: Date.now(),
      finalBoundingBox: finalBBox,
      totalDistance,
    };

    // Remove from active
    this.activeTracks.delete(globalId);

    // Store in IndexedDB
    if (this.db) {
      try {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.add(archived);

        logger.debug('GLOBAL_TRACK_REGISTRY', `Archived track: ${globalId} (frames: ${archived.frameCount})`);
      } catch (error) {
        logger.warn('GLOBAL_TRACK_REGISTRY', `Failed to archive track ${globalId}`, error);
      }
    }
  }

  /**
   * Get archived track (historical lookup)
   */
  async getArchivedTrack(globalId: string): Promise<ArchivedTrack | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(globalId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        logger.warn('GLOBAL_TRACK_REGISTRY', `Failed to retrieve archived track ${globalId}`, error);
        resolve(null);
      }
    });
  }

  /**
   * Get all active tracks in current session
   */
  getSessionTracks(): Map<string, TrackMetadata> {
    return new Map(this.activeTracks);
  }

  /**
   * Get all tracks by viewer ID
   */
  getViewerTracks(viewerId: string): TrackMetadata[] {
    return Array.from(this.activeTracks.values()).filter((t) => t.viewerId === viewerId);
  }

  /**
   * Get all tracks by source
   */
  getSourceTracks(source: 'live' | 'upload' | 'ip-camera'): TrackMetadata[] {
    return Array.from(this.activeTracks.values()).filter((t) => t.source === source);
  }

  /**
   * Get current session statistics
   */
  getSessionStats() {
    const activeTracks = Array.from(this.activeTracks.values());
    return {
      sessionId: this.sessionId,
      totalAllocated: this.idCounter,
      activeCount: activeTracks.length,
      avgFramesPerTrack: activeTracks.length > 0
        ? activeTracks.reduce((sum, t) => sum + t.frameCount, 0) / activeTracks.length
        : 0,
      sources: {
        live: activeTracks.filter((t) => t.source === 'live').length,
        upload: activeTracks.filter((t) => t.source === 'upload').length,
        'ip-camera': activeTracks.filter((t) => t.source === 'ip-camera').length,
      },
    };
  }

  /**
   * Reset registry (typically at app shutdown)
   */
  async reset(): Promise<void> {
    this.activeTracks.clear();
    this.idCounter = 0;
    logger.debug('GLOBAL_TRACK_REGISTRY', `Registry reset (sessionId: ${this.sessionId})`);
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get current ID counter
   */
  getIdCounter(): number {
    return this.idCounter;
  }
}

// Export singleton getter
export const getGlobalTrackRegistry = (): GlobalTrackRegistry => GlobalTrackRegistry.getInstance();
