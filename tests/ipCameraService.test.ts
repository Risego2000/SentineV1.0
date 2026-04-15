import { describe, expect, it } from 'vitest';
import { isSupportedIpCameraUrl, sanitizeCameraUrlForLogs } from '../services/ipCameraService';

describe('ipCameraService', () => {
  it('sanitizes credentials and query params from camera urls', () => {
    const sanitized = sanitizeCameraUrlForLogs(
      'https://admin:secret@example.com/live.mjpg?token=123'
    );

    expect(sanitized).toBe('https://example.com/live.mjpg');
  });

  it('accepts only http and https camera urls for browser-safe proxying', () => {
    expect(isSupportedIpCameraUrl('https://camera.local/live')).toBe(true);
    expect(isSupportedIpCameraUrl('http://camera.local/live')).toBe(true);
    expect(isSupportedIpCameraUrl('rtsp://camera.local/live')).toBe(false);
  });
});
