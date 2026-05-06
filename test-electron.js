import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';

const ROOT = process.cwd();
const IS_WIN = process.platform === 'win32';
const ELECTRON_BIN = IS_WIN
  ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(ROOT, 'node_modules', '.bin', 'electron');
const PORT_FILE = path.join(os.tmpdir(), 'sentinel-api-port.txt');
const START_TIMEOUT_MS = 45000;
const HEALTH_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readDetectedPort = () => {
  try {
    if (!fs.existsSync(PORT_FILE)) return null;
    const raw = fs.readFileSync(PORT_FILE, 'utf8').trim();
    const port = Number(raw);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
};

const requestHealth = (port) =>
  new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: HEALTH_TIMEOUT_MS,
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        res.resume();
        if (statusCode === 200) {
          resolve(true);
          return;
        }
        reject(new Error(`Unexpected /api/health status: ${statusCode}`));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Health request timeout')));
    req.on('error', reject);
  });

const killTree = (child) =>
  new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    if (IS_WIN) {
      const killer = spawn('cmd.exe', ['/c', 'taskkill', '/PID', String(child.pid), '/T', '/F']);
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
      return;
    }
    child.kill('SIGTERM');
    resolve();
  });

const run = async () => {
  if (!fs.existsSync(ELECTRON_BIN)) {
    throw new Error(`Electron binary not found: ${ELECTRON_BIN}`);
  }

  console.log('[E2E:Electron] Starting Electron smoke test...');
  const child = IS_WIN
    ? spawn(ELECTRON_BIN, ['.'], {
        cwd: ROOT,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    : spawn(ELECTRON_BIN, ['.'], {
        cwd: ROOT,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

  let settled = false;
  let lastLogs = [];

  const capture = (line) => {
    const text = String(line || '').trim();
    if (!text) return;
    lastLogs.push(text);
    if (lastLogs.length > 30) lastLogs = lastLogs.slice(-30);
    console.log(text);
  };

  child.stdout.on('data', (chunk) =>
    String(chunk)
      .split(/\r?\n/)
      .forEach(capture)
  );
  child.stderr.on('data', (chunk) =>
    String(chunk)
      .split(/\r?\n/)
      .forEach(capture)
  );

  const done = async (ok, error) => {
    if (settled) return;
    settled = true;
    await killTree(child);
    if (!ok) {
      const tail = lastLogs.slice(-12).join('\n');
      throw new Error(`${error?.message || 'Electron smoke test failed'}\n--- logs tail ---\n${tail}`);
    }
  };

  child.on('exit', async (code) => {
    if (!settled) {
      await done(false, new Error(`Electron exited prematurely with code ${code}`));
    }
  });

  const startedAt = Date.now();
  let lastPort = null;
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    const port = readDetectedPort();
    if (port) {
      lastPort = port;
      try {
        await requestHealth(port);
        await done(true);
        console.log(`[E2E:Electron] ✓ Smoke OK (backend port ${port})`);
        return;
      } catch {
        // Keep waiting: port file may be stale or server not ready yet.
      }
    }
    await sleep(500);
  }

  await done(
    false,
    new Error(
      `Timed out waiting for healthy Electron backend${lastPort ? ` (last port seen: ${lastPort})` : ''}`
    )
  );
};

run().catch((error) => {
  console.error(`[E2E:Electron] ✗ ${error.message}`);
  process.exit(1);
});
