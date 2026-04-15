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
 * - IPv4 loopback 127.0.0.0/8
 * - IPv4 private 10/8, 172.16/12, 192.168/16
 * - IPv4 link-local 169.254/16
 * - IPv6 loopback ::1
 * - IPv6 link-local fe80::/10
 * - IPv6 ULA fc00::/7 (fc and fd prefixes)
 * - IPv4-mapped IPv6 ::ffff:<IPv4>
 */
export const isPrivateAddress = (address: string): boolean => {
  if (!net.isIP(address)) return true;

  // IPv4
  if (address === '127.0.0.1') return true;
  if (address.startsWith('10.')) return true;
  if (address.startsWith('192.168.')) return true;
  if (address.startsWith('169.254.')) return true;
  if (address.startsWith('172.')) {
    const second = Number(address.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }

  // IPv6
  const lower = address.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));

  return false;
};

/**
 * Sanitizes an untrusted filename to prevent directory traversal.
 */
export const sanitizeFilename = (requestedFilename: string, extension: string): string => {
  const base = path.basename(String(requestedFilename));
  const safe = base
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) return '_';
      if (/[<>:"/\\|?*]/.test(char)) return '_';
      return char;
    })
    .join('')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '_');

  const name = safe || `file_${Date.now()}`;
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
};

/**
 * Checks that `targetPath` resolves to a location strictly inside `allowedDir`.
 */
export const isPathWithinDir = (targetPath: string, allowedDir: string): boolean => {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(allowedDir);
  return resolved === base || resolved.startsWith(base + path.sep);
};

/**
 * Validates a camera hostname.
 */
export const validateCameraHost = async (
  hostname: string,
  allowedHosts: string[] = []
): Promise<boolean> => {
  if (!hostname) throw new Error('Host de cámara IP no válido.');

  if (allowedHosts.length > 0) {
    return allowedHosts.includes(hostname.toLowerCase());
  }

  const results = await dns.lookup(hostname, { all: true });
  return results.length > 0 && !results.some(({ address }) => isPrivateAddress(address));
};
