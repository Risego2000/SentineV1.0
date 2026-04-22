// Detect video codec from file using extension and header inspection
export async function detectVideoCodec(file: File): Promise<'h264' | 'hevc' | 'unknown'> {
  const name = file.name.toLowerCase();

  // Extension-based detection (fast path)
  const hevcExtensions = ['.hevc', '.265', '.h265', '.mts', '.m2ts'];
  if (hevcExtensions.some(ext => name.endsWith(ext))) {
    return 'hevc';
  }

  // For .mp4, .mkv, .mov files, check file header
  if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.mkv')) {
    try {
      // Read first 512 bytes to inspect codec signature
      const headerBytes = await file.slice(0, 512).arrayBuffer();
      const view = new Uint8Array(headerBytes);
      const headerStr = String.fromCharCode(...view);

      // H.265/HEVC specific markers in MP4
      if (headerStr.includes('hev1') || headerStr.includes('hvc1')) {
        return 'hevc';
      }

      // H.264/AVC specific markers
      if (headerStr.includes('avc1')) {
        return 'h264';
      }
    } catch (err) {
      console.warn('[Codec Detector] Error reading file header:', err);
    }
  }

  return 'unknown';
}
