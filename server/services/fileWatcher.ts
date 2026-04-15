/**
 * FileWatcherService - Automatic file synchronization to Supabase
 * Monitors evidence folders and syncs new files to the database.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { supabase, SUPABASE_TABLES } from '../../services/supabase';

interface FileWatchConfig {
  folder: string;
  patterns: RegExp[];
  table: string;
  fieldMapper: (filePath: string, stats: fs.Stats) => Record<string, unknown>;
}

interface WatchedFile {
  path: string;
  modified: number;
  synced: boolean;
}

class FileWatcherService {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private watchedFiles: Map<string, WatchedFile> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private supabaseConfigured: boolean | null = null;
  private lastSyncTimes: Map<string, number> = new Map();
  private readonly SYNC_INTERVAL_MS = 5000;
  private readonly DATA_DIR = path.join(os.homedir(), '.sentinel', 'data');

  private configs: FileWatchConfig[] = [
    {
      folder: process.env.REPORTS_DIR || 'C:\\Denuncias',
      patterns: [/\.pdf$/i, /\.mp4$/i, /\.webm$/i],
      table: SUPABASE_TABLES.REPORTS,
      fieldMapper: (filePath: string, stats: fs.Stats) => {
        const filename = path.basename(filePath);
        return {
          filename,
          file_path: filePath,
          created_at: stats.birthtime.toISOString(),
          file_size: stats.size,
        };
      },
    },
    {
      folder: this.DATA_DIR,
      patterns: [/\.(jpg|jpeg|png|mp4|webm)$/i],
      table: SUPABASE_TABLES.EVIDENCE,
      fieldMapper: (filePath: string, stats: fs.Stats) => {
        const filename = path.basename(filePath);
        const id = crypto.randomUUID();
        return {
          id,
          track_id: null,
          geometry_id: null,
          rule_id: null,
          data: { filename },
          status: 'pending',
          video_file: filename.endsWith('.mp4') || filename.endsWith('.webm') ? filename : null,
          playback_time: null,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        };
      },
    },
  ];

  constructor() {
    // Defer check to initialize() to allow loadLocalEnvFile() to run first
  }

  private checkSupabaseConfigured(): boolean {
    if (this.supabaseConfigured !== null) return this.supabaseConfigured;
    this.supabaseConfigured = Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
      (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
    );
    return this.supabaseConfigured;
  }

  async initialize(): Promise<void> {
    if (!this.checkSupabaseConfigured()) {
      console.log('[FileWatcher] Supabase not configured, skipping initialization');
      return;
    }

    console.log('[FileWatcher] Initializing file watchers...');

    for (const config of this.configs) {
      await this.setupWatcher(config);
    }

    this.syncInterval = setInterval(() => this.syncToSupabase(), this.SYNC_INTERVAL_MS);

    console.log('[FileWatcher] File watchers initialized');
  }

  private async setupWatcher(config: FileWatchConfig): Promise<void> {
    const { folder, patterns } = config;

    if (!fs.existsSync(folder)) {
      console.log(`[FileWatcher] Creating folder: ${folder}`);
      fs.mkdirSync(folder, { recursive: true });
    }

    try {
      const watcher = fs.watch(folder, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(folder, filename);

        if (eventType === 'rename' && fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && patterns.some((p) => p.test(filename))) {
            this.handleNewFile(fullPath, stats);
          }
        } else if (eventType === 'change' && fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && patterns.some((p) => p.test(filename))) {
            this.handleModifiedFile(fullPath, stats);
          }
        }
      });

      watcher.on('error', (error) => {
        console.error(`[FileWatcher] Error watching ${folder}:`, error);
      });

      this.watchers.set(folder, watcher);
      console.log(`[FileWatcher] Watching: ${folder}`);

      const existingFiles = this.scanExistingFiles(folder, patterns);
      for (const file of existingFiles) {
        this.watchedFiles.set(file, { path: file, modified: Date.now(), synced: false });
      }
    } catch (error) {
      console.error(`[FileWatcher] Failed to setup watcher for ${folder}:`, error);
    }
  }

  private scanExistingFiles(folder: string, patterns: RegExp[]): string[] {
    const files: string[] = [];

    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile() && patterns.some((p) => p.test(entry.name))) {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    scan(folder);
    return files;
  }

  private handleNewFile(filePath: string, stats: fs.Stats): void {
    const existing = this.watchedFiles.get(filePath);
    if (existing) {
      existing.modified = Date.now();
      existing.synced = false;
    } else {
      console.log(`[FileWatcher] New file detected: ${filePath}`);
      this.watchedFiles.set(filePath, {
        path: filePath,
        modified: Date.now(),
        synced: false,
      });
    }
  }

  private handleModifiedFile(filePath: string, stats: fs.Stats): void {
    const existing = this.watchedFiles.get(filePath);
    if (existing) {
      console.log(`[FileWatcher] File modified: ${filePath}`);
      existing.modified = Date.now();
      existing.synced = false;
    }
  }

  async syncToSupabase(): Promise<{ synced: number; failed: number }> {
    if (!this.checkSupabaseConfigured()) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const [filePath, watchedFile] of this.watchedFiles.entries()) {
      if (watchedFile.synced) continue;

      const timeSinceModified = Date.now() - watchedFile.modified;
      if (timeSinceModified < 2000) continue;

      const config = this.findConfigForFile(filePath);
      if (!config) continue;

      try {
        const stats = fs.statSync(filePath);
        const data = config.fieldMapper(filePath, stats);

        const { error } = await supabase.from(config.table).insert(data);

        if (error) {
          console.error(`[FileWatcher] Sync error for ${filePath}:`, error);
          failed++;
        } else {
          watchedFile.synced = true;
          this.lastSyncTimes.set(filePath, Date.now());
          synced++;
          console.log(`[FileWatcher] Synced: ${filePath}`);
        }
      } catch (error) {
        console.error(`[FileWatcher] Error syncing ${filePath}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  private findConfigForFile(filePath: string): FileWatchConfig | null {
    for (const config of this.configs) {
      const relativePath = path.relative(config.folder, filePath);
      if (!relativePath.startsWith('..')) {
        return config;
      }
    }
    return null;
  }

  getStatus(): {
    active: boolean;
    watchedFolders: string[];
    pendingFiles: number;
    lastSync: Record<string, number>;
  } {
    return {
      active: this.syncInterval !== null,
      watchedFolders: Array.from(this.watchers.keys()),
      pendingFiles: Array.from(this.watchedFiles.values()).filter((f) => !f.synced).length,
      lastSync: Object.fromEntries(this.lastSyncTimes),
    };
  }

  async shutdown(): Promise<void> {
    console.log('[FileWatcher] Shutting down...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    for (const [folder, watcher] of this.watchers) {
      watcher.close();
      console.log(`[FileWatcher] Stopped watching: ${folder}`);
    }

    this.watchers.clear();
    this.watchedFiles.clear();
  }
}

export const fileWatcherService = new FileWatcherService();
export { FileWatcherService };
