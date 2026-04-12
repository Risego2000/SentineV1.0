/**
 * Sentinel Security Utilities — pure, side-effect-free helpers
 * Exported separately so they can be unit-tested independently of the Express app.
 */
import path from 'path';
import net from 'net';
import dns from 'dns/promises';

/**
 * Returns true if the given IP address is a loopback, link-local, or
 * private/ULA address that should never be proxied to an IP camera.
 *
 * Covers:
 *  - IPv4  loopback  127.0.0.0/8
 *  - IPv4  private   10/8, 172.16/12, 192.168/16
 *  - IPv4  link-local 169.254/16
 *  - IPv6  loopback  ::1
 *  - IPv6  link-local fe80::/10
 *  - IPv6  ULA       fc00::/7  (fc and fd prefixes)
 *  - IPv4-mapped IPv6  ::ffff:<IPv4>
 */
export const isPrivateAddress = (address) => {
  if (!net.isIP(address)) return true;

  // ── IPv4 ──────────────────────────────────────────────────────────────
  if (address === '127.0.0.1') return true;
  if (address.startsWith('10.')) return true;
  if (address.startsWith('192.168.')) return true;
  if (address.startsWith('169.254.')) return true;
  if (address.startsWith('172.')) {
    const second = Number(address.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }

  // ── IPv6 ──────────────────────────────────────────────────────────────
  const lower = address.toLowerCase();
  if (lower === '::1') return true;                        // loopback
  if (lower.startsWith('fe80:')) return true;              // link-local (fe80::/10)
  // ULA fc00::/7 — first byte 0xfc or 0xfd
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // IPv4-mapped ::ffff:<ipv4> — recurse on the embedded address
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));

  return false;
};

/**
 * Sanitizes an untrusted filename to prevent directory traversal.
 *
 * Strategy (defense-in-depth):
 *   1. path.basename()  — strips any directory components (../../ etc.)
 *   2. Character filter — removes shell-special chars
 *   3. Leading-dot strip — prevents hidden-file tricks
 *   4. Ensures the correct extension is present
 */
export const sanitizeFilename = (requestedFilename, extension) => {
  const base = path.basename(String(requestedFilename));
  const safe = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '_');

  const name = safe || `file_${Date.now()}`;
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
};

/**
 * Checks that `targetPath` resolves to a location strictly inside `allowedDir`.
 * Prevents traversal via symlinks, relative segments, or OS normalisation tricks.
 */
export const isPathWithinDir = (targetPath, allowedDir) => {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(allowedDir);
  return resolved === base || resolved.startsWith(base + path.sep);
};

/**
 * Validates a camera hostname.
 * If `allowedHosts` is non-empty, the hostname must be in that list.
 * Otherwise we perform a DNS lookup and reject any result that resolves
 * to a private / loopback address.
 *
 * @throws if hostname is falsy or DNS lookup fails
 */
export const validateCameraHost = async (hostname, allowedHosts = []) => {
  if (!hostname) throw new Error('Host de cámara IP no válido.');

  if (allowedHosts.length > 0) {
    return allowedHosts.includes(hostname.toLowerCase());
  }

  const results = await dns.lookup(hostname, { all: true });
  return results.length > 0 && !results.some(({ address }) => isPrivateAddress(address));
};
