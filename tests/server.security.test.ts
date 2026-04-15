/**
 * Security unit tests for server-side utilities.
 * Covers: private-address detection, filename sanitization, path containment.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  isPrivateAddress,
  sanitizeFilename,
  isPathWithinDir,
} from '../services/serverSecurityUtils.ts';

// ─── isPrivateAddress ─────────────────────────────────────────────────────────

describe('isPrivateAddress — IPv4', () => {
  it('blocks loopback 127.0.0.1', () => expect(isPrivateAddress('127.0.0.1')).toBe(true));
  it('blocks class-A private 10.x.x.x', () => expect(isPrivateAddress('10.0.0.1')).toBe(true));
  it('blocks 192.168.x.x', () => expect(isPrivateAddress('192.168.1.100')).toBe(true));
  it('blocks 172.16.x.x (start of range)', () => expect(isPrivateAddress('172.16.0.1')).toBe(true));
  it('blocks 172.31.x.x (end of range)', () =>
    expect(isPrivateAddress('172.31.255.254')).toBe(true));
  it('allows 172.15.x.x (below range)', () => expect(isPrivateAddress('172.15.0.1')).toBe(false));
  it('allows 172.32.x.x (above range)', () => expect(isPrivateAddress('172.32.0.1')).toBe(false));
  it('blocks link-local 169.254.x.x', () => expect(isPrivateAddress('169.254.0.1')).toBe(true));
  it('allows public IP 8.8.8.8', () => expect(isPrivateAddress('8.8.8.8')).toBe(false));
  it('allows public IP 1.1.1.1', () => expect(isPrivateAddress('1.1.1.1')).toBe(false));
});

describe('isPrivateAddress — IPv6', () => {
  it('blocks loopback ::1', () => expect(isPrivateAddress('::1')).toBe(true));
  it('blocks link-local fe80::1', () => expect(isPrivateAddress('fe80::1')).toBe(true));
  it('blocks link-local fe80::abcd', () => expect(isPrivateAddress('fe80::abcd')).toBe(true));
  it('blocks ULA fc00::1', () => expect(isPrivateAddress('fc00::1')).toBe(true));
  it('blocks ULA fd00::1', () => expect(isPrivateAddress('fd00::1')).toBe(true));
  it('blocks IPv4-mapped loopback ::ffff:127.0.0.1', () =>
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true));
  it('blocks IPv4-mapped private ::ffff:192.168.1.1', () =>
    expect(isPrivateAddress('::ffff:192.168.1.1')).toBe(true));
  it('allows public IPv6 2606:4700::1', () => expect(isPrivateAddress('2606:4700::1')).toBe(false));
});

describe('isPrivateAddress — edge cases', () => {
  it('rejects non-IP strings', () => expect(isPrivateAddress('not-an-ip')).toBe(true));
  it('rejects empty string', () => expect(isPrivateAddress('')).toBe(true));
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

describe('sanitizeFilename — path traversal', () => {
  it('strips leading ../../ sequences', () => {
    const result = sanitizeFilename('../../etc/passwd', '.pdf');
    expect(result).not.toContain('..');
    expect(result).not.toMatch(/[/\\]/);
  });

  it('strips Windows-style ..\\..\\', () => {
    const result = sanitizeFilename('..\\..\\Windows\\system32\\cmd.exe', '.pdf');
    expect(result).not.toContain('..');
    expect(result).not.toMatch(/[/\\]/);
  });

  it('strips absolute Unix paths', () => {
    const result = sanitizeFilename('/etc/passwd', '.pdf');
    expect(result).not.toContain('/');
    expect(result).not.toContain('etc');
  });
});

describe('sanitizeFilename — extension handling', () => {
  it('adds .pdf extension when missing', () =>
    expect(sanitizeFilename('report', '.pdf')).toMatch(/\.pdf$/));

  it('keeps existing .pdf extension', () =>
    expect(sanitizeFilename('report.pdf', '.pdf')).toMatch(/\.pdf$/));

  it('adds .mp4 extension', () => expect(sanitizeFilename('evidence', '.mp4')).toMatch(/\.mp4$/));
});

describe('sanitizeFilename — valid filenames', () => {
  it('preserves alphanumeric name', () => {
    const result = sanitizeFilename('Sentinel_2024_Report', '.pdf');
    expect(result).toBe('Sentinel_2024_Report.pdf');
  });

  it('replaces spaces with underscores', () => {
    const result = sanitizeFilename('my report 2024', '.pdf');
    expect(result).not.toContain(' ');
  });
});

// ─── isPathWithinDir ──────────────────────────────────────────────────────────

describe('isPathWithinDir', () => {
  const BASE = path.resolve('reports');

  it('allows a file directly inside the dir', () => {
    expect(isPathWithinDir(path.join(BASE, 'file.pdf'), BASE)).toBe(true);
  });

  it('allows a file in a subdirectory', () => {
    expect(isPathWithinDir(path.join(BASE, 'sub', 'file.pdf'), BASE)).toBe(true);
  });

  it('rejects path that escapes via ../', () => {
    const evil = path.join(BASE, '..', 'etc', 'passwd');
    expect(isPathWithinDir(evil, BASE)).toBe(false);
  });

  it('rejects completely unrelated path', () => {
    expect(isPathWithinDir(path.resolve('etc', 'passwd'), BASE)).toBe(false);
  });

  it('rejects path that is a sibling with shared prefix (e.g. reports2/)', () => {
    const sibling = path.resolve('reports2', 'file.pdf');
    expect(isPathWithinDir(sibling, BASE)).toBe(false);
  });
});
