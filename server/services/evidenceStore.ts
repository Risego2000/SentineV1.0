/**
 * Evidence Store API - Server-side persistence
 * Single source of truth for evidence and infractions.
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface EvidenceRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'infraction' | 'evidence';
  data: {
    trackId?: number;
    geometryId?: string;
    ruleId?: string;
    snapshots?: string[];
    contextSnapshots?: string[];
    zoomSnapshots?: string[];
    ocrResults?: string[];
    clip?: string;
    plate?: string;
    description?: string;
    severity?: string;
  };
  metadata: {
    videoFile?: string;
    playbackTime?: number;
    localTime?: string;
    videoTimeCode?: string;
  };
}

interface InfractionRecord extends EvidenceRecord {
  auditResult: {
    infraction: boolean;
    plate: string;
    makeModel: string;
    color: string;
    description: string;
    severity: string;
    ruleCategory: string;
    legalBase: string;
    reasoning: string[];
    visualTimestamp: string;
    videoTimeCode: string;
    localTime: string;
    telemetry: Record<string, string>;
  };
  reportPath?: string;
  reportGeneratedAt?: number;
}

const REPORTS_DIR = process.env.REPORTS_DIR || 'C:\\Denuncias';
const DATA_DIR = path.join(os.homedir(), '.sentinel', 'data');

let evidenceStore: Map<string, EvidenceRecord> = new Map();
let infractionStore: Map<string, InfractionRecord> = new Map();

// Ensure directories exist
fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// Load persisted data
const evidencePath = path.join(DATA_DIR, 'evidence.json');
const infractionsPath = path.join(DATA_DIR, 'infractions.json');

function loadPersistedData() {
  try {
    if (fs.existsSync(evidencePath)) {
      const data = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
      evidenceStore = new Map(Object.entries(data));
    }
  } catch (e) {
    console.warn('[EVIDENCE_STORE] Could not load evidence data:', e);
  }

  try {
    if (fs.existsSync(infractionsPath)) {
      const data = JSON.parse(fs.readFileSync(infractionsPath, 'utf-8'));
      infractionStore = new Map(Object.entries(data));
    }
  } catch (e) {
    console.warn('[EVIDENCE_STORE] Could not load infractions data:', e);
  }
}

function persistData() {
  try {
    fs.writeFileSync(evidencePath, JSON.stringify(Object.fromEntries(evidenceStore)));
  } catch (e) {
    console.error('[EVIDENCE_STORE] Failed to persist evidence:', e);
  }

  try {
    fs.writeFileSync(infractionsPath, JSON.stringify(Object.fromEntries(infractionStore)));
  } catch (e) {
    console.error('[EVIDENCE_STORE] Failed to persist infractions:', e);
  }
}

loadPersistedData();

// Auto-persist every 30 seconds
setInterval(persistData, 30_000);

export function createEvidenceStoreRouter() {
  const router = express.Router();

  // Save evidence
  router.post('/evidence', express.json({ limit: '100mb' }), (req: Request, res: Response) => {
    try {
      const {
        id,
        trackId,
        geometryId,
        ruleId,
        snapshots,
        contextSnapshots,
        zoomSnapshots,
        ocrResults,
        clip,
        videoFile,
        playbackTime,
        localTime,
        videoTimeCode,
      } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Evidence ID required' });
        return;
      }

      const record: EvidenceRecord = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'pending',
        type: 'evidence',
        data: {
          trackId,
          geometryId,
          ruleId,
          snapshots,
          contextSnapshots,
          zoomSnapshots,
          ocrResults,
          clip,
        },
        metadata: {
          videoFile,
          playbackTime,
          localTime,
          videoTimeCode,
        },
      };

      evidenceStore.set(id, record);
      persistData();

      res.json({ saved: true, id });
    } catch (error) {
      console.error('[EVIDENCE_STORE] Save error:', error);
      res.status(500).json({ error: 'Failed to save evidence' });
    }
  });

  // Get evidence
  router.get('/evidence/:id', (req: Request, res: Response) => {
    const record = evidenceStore.get(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }
    res.json(record);
  });

  // Delete evidence
  router.delete('/evidence/:id', (req: Request, res: Response) => {
    const existed = evidenceStore.delete(req.params.id);
    if (existed) persistData();
    res.json({ deleted: existed });
  });

  // Update evidence status
  router.patch('/evidence/:id/status', express.json(), (req: Request, res: Response) => {
    const record = evidenceStore.get(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    record.status = req.body.status;
    record.updatedAt = Date.now();
    evidenceStore.set(record.id, record);
    persistData();

    res.json({ updated: true });
  });

  // Save infraction
  router.post('/infractions', express.json({ limit: '100mb' }), (req: Request, res: Response) => {
    try {
      const { id, evidenceId, auditResult, ...rest } = req.body;

      if (!id || !auditResult) {
        res.status(400).json({ error: 'ID and auditResult required' });
        return;
      }

      const record: InfractionRecord = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'completed',
        type: 'infraction',
        data: rest.data || {},
        metadata: rest.metadata || {},
        auditResult,
      };

      infractionStore.set(id, record);

      // Link to evidence if provided
      if (evidenceId && evidenceStore.has(evidenceId)) {
        const evidence = evidenceStore.get(evidenceId)!;
        evidence.status = 'completed';
        evidence.updatedAt = Date.now();
        evidenceStore.set(evidenceId, evidence);
      }

      persistData();

      res.json({ saved: true, id });
    } catch (error) {
      console.error('[EVIDENCE_STORE] Infraction save error:', error);
      res.status(500).json({ error: 'Failed to save infraction' });
    }
  });

  // Get all infractions
  router.get('/infractions', (req: Request, res: Response) => {
    const infractions = Array.from(infractionStore.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
    res.json({ infractions });
  });

  // Get infraction by ID
  router.get('/infractions/:id', (req: Request, res: Response) => {
    const record = infractionStore.get(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Infraction not found' });
      return;
    }
    res.json(record);
  });

  // Update infraction report path
  router.patch('/infractions/:id/report', express.json(), (req: Request, res: Response) => {
    const record = infractionStore.get(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Infraction not found' });
      return;
    }

    record.reportPath = req.body.path;
    record.reportGeneratedAt = Date.now();
    record.updatedAt = Date.now();
    infractionStore.set(record.id, record);
    persistData();

    res.json({ updated: true });
  });

  // Export infractions as JSON
  router.get('/infractions/export', (req: Request, res: Response) => {
    const format = req.query.format || 'json';
    const infractions = Array.from(infractionStore.values());

    if (format === 'csv') {
      const headers = [
        'id',
        'plate',
        'makeModel',
        'color',
        'severity',
        'ruleCategory',
        'createdAt',
        'reportPath',
      ];
      const rows = infractions.map((i) =>
        headers
          .map((h) => {
            if (h === 'createdAt') return new Date(i.createdAt).toISOString();
            if (h === 'auditResult') return JSON.stringify(i.auditResult);
            const auditValue = (i.auditResult as Record<string, unknown>)[h];
            const recordValue = (i as unknown as Record<string, unknown>)[h];
            return String(auditValue ?? recordValue ?? '');
          })
          .join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="infractions_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({ infractions, exportedAt: new Date().toISOString() });
    }
  });

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      evidence: evidenceStore.size,
      infractions: infractionStore.size,
      dataDir: DATA_DIR,
      reportsDir: REPORTS_DIR,
    });
  });

  // Stats
  router.get('/stats', (req: Request, res: Response) => {
    const infractions = Array.from(infractionStore.values());
    const bySeverity = infractions.reduce(
      (acc, i) => {
        const sev = i.auditResult?.severity || 'UNKNOWN';
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byCategory = infractions.reduce(
      (acc, i) => {
        const cat = i.auditResult?.ruleCategory || 'UNKNOWN';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      total: infractions.length,
      withReport: infractions.filter((i) => i.reportPath).length,
      bySeverity,
      byCategory,
    });
  });

  return router;
}

export { evidenceStore, infractionStore };
