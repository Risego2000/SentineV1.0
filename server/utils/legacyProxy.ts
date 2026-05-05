import type { Request, Response } from 'express';

function getLegacyBaseUrl(): string {
  return (process.env.SENTINEL_LEGACY_API_BASE_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '');
}

function shouldSkipHeader(name: string): boolean {
  const key = name.toLowerCase();
  return key === 'host' || key === 'content-length' || key === 'connection';
}

export async function proxyToLegacy(req: Request, res: Response): Promise<void> {
  const legacyBase = getLegacyBaseUrl();
  const targetUrl = `${legacyBase}${req.originalUrl}`;
  const headers = new Headers();

  for (const [key, raw] of Object.entries(req.headers)) {
    if (shouldSkipHeader(key)) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
    } else if (typeof raw === 'string') {
      headers.set(key, raw);
    }
  }

  try {
    const method = req.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? (req as any) : undefined,
      duplex: hasBody ? ('half' as any) : undefined,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (shouldSkipHeader(key)) return;
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(502).json({
      error: 'Legacy proxy failed',
      targetUrl,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

