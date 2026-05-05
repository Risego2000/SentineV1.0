// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { startServer } from '../server/index';

let baseUrl = '';
let serverRef: any = null;

beforeAll(async () => {
  process.env.SENTINEL_API_TOKEN = '';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3002';

  const { app } = await startServer();
  await new Promise<void>((resolve) => {
    serverRef = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = serverRef.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Server address is not available');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!serverRef) return;
  await new Promise<void>((resolve) => serverRef.close(() => resolve()));
});

describe('Minimal API baseline', () => {
  it('GET /health responds 200', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  it('GET /ready responds 200 or 503', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    expect([200, 503]).toContain(res.status);
  }, 20_000);

  it('GET /api/health responds 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it('POST /api/ocr/plate validates payload and responds 400 on empty body', async () => {
    const res = await fetch(`${baseUrl}/api/ocr/plate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/ocr/timestamp validates payload and responds 400 on empty body', async () => {
    const res = await fetch(`${baseUrl}/api/ocr/timestamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/geometry validates payload and responds 400 on missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/ai/geometry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/audit validates payload and responds 400 on missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/ai/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
