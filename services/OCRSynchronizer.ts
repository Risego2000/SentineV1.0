import { getApiUrl } from './apiConfig';
import { isElectron, getElectronAPI } from '../utils/electronDetect';

interface PlateOCRResult {
  plate: string;
  candidates: string[];
}

/**
 * Service for OCR processing using PaddleOCR backend.
 * Supports both Electron IPC and HTTP backends.
 */
export const OCRSynchronizer = {
  normalizePlate(text: string): string {
    const compact = text
      .toUpperCase()
      .replace(/[\s\-_.:]/g, '')
      .replace(/[^A-Z0-9]/g, '');

    const spainMatches = compact.match(/\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}/g);
    if (spainMatches?.length) return spainMatches[0];

    const genericMatches = compact.match(/[A-Z0-9]{6,8}/g);
    return genericMatches?.[0] || '';
  },

  async extractLicensePlate(zoomFrames: string[]): Promise<PlateOCRResult> {
    if (!zoomFrames.length) return { plate: '', candidates: [] };

    try {
      // Use IPC if running in Electron, otherwise use HTTP
      if (isElectron()) {
        const api = getElectronAPI();
        const result = await api.ipc.invoke('ocr:extractPlate', {
          images: zoomFrames,
        });
        const normalizedCandidates = (result.candidates || [])
          .map((c: any) =>
            OCRSynchronizer.normalizePlate(typeof c === 'string' ? c : c?.text || c?.plate || '')
          )
          .filter(Boolean);
        const normalizedPlate = OCRSynchronizer.normalizePlate(
          result.plate || normalizedCandidates[0] || ''
        );

        if (normalizedPlate) {
          return {
            plate: normalizedPlate,
            candidates: [...new Set([normalizedPlate, ...normalizedCandidates])],
          };
        }
      } else {
        // Try hybrid YOLO+Gemini endpoint first (best accuracy)
        try {
          const hybridResponse = await fetch(getApiUrl('/api/ocr/plate-yolo-hybrid'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              zoomFrames: zoomFrames,
            }),
          });

          if (hybridResponse.ok) {
            const result = await hybridResponse.json();
            const normalizedCandidates = (result.candidates || [])
              .map((c: any) =>
                OCRSynchronizer.normalizePlate(typeof c === 'string' ? c : c?.text || c?.plate || '')
              )
              .filter(Boolean);
            const normalizedPlate = OCRSynchronizer.normalizePlate(
              result.plate || normalizedCandidates[0] || ''
            );

            if (normalizedPlate) {
              console.log('[OCR] ✓ Using YOLO hybrid detection');
              return {
                plate: normalizedPlate,
                candidates: [...new Set([normalizedPlate, ...normalizedCandidates])],
              };
            }
          }
        } catch (hybridError) {
          console.warn('[OCR] YOLO hybrid failed, trying standard OCR:', hybridError);
        }

        // Fallback: Standard Gemini-based OCR
        const response = await fetch(getApiUrl('/api/ocr/plate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: zoomFrames,
          }),
        });

        if (!response.ok) {
          throw new Error(`OCR API error: ${response.status}`);
        }

        const result = await response.json();
        const normalizedCandidates = (result.candidates || [])
          .map((c: any) =>
            OCRSynchronizer.normalizePlate(typeof c === 'string' ? c : c?.text || c?.plate || '')
          )
          .filter(Boolean);
        const normalizedPlate = OCRSynchronizer.normalizePlate(
          result.plate || normalizedCandidates[0] || ''
        );

        if (normalizedPlate) {
          return {
            plate: normalizedPlate,
            candidates: [...new Set([normalizedPlate, ...normalizedCandidates])],
          };
        }
      }

      // Automatic backup: Gemini confirm on best frame if primary returns empty.
      for (const frame of zoomFrames) {
        const confirmResponse = await fetch(getApiUrl('/api/ocr/plate-confirm'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: frame }),
        });
        if (confirmResponse.ok) {
          const confirm = await confirmResponse.json();
          const recovered = OCRSynchronizer.normalizePlate(confirm?.plate || '');
          if (recovered) {
            return {
              plate: recovered,
              candidates: [recovered],
            };
          }
        }
      }

      return { plate: '', candidates: [] };
    } catch (e) {
      console.error('[OCR] Error extracting license plate:', e);
      return { plate: '', candidates: [] };
    }
  },

  /**
   * Extract timestamp from video frame using PaddleOCR backend.
   * Processes top-left corner where OSD (On-Screen Display) timecode appears.
   */
  async extractTimecode(video: HTMLVideoElement): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Define OSD Region (Top-Left Focus)
    const scanW = video.videoWidth * 0.7;
    const scanH = video.videoHeight * 0.15;

    canvas.width = scanW;
    canvas.height = scanH;

    // Draw region to canvas (Top-Left)
    ctx.drawImage(video, 0, 0, scanW, scanH, 0, 0, scanW, scanH);

    // Convert canvas to base64
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      // Use IPC if running in Electron, otherwise use HTTP
      if (isElectron()) {
        const api = getElectronAPI();
        const result = await api.ipc.invoke('ocr:extractTimestamp', {
          image: base64Image,
        });
        const timestamp = result.timestamp || '';

        if (!timestamp) {
          console.warn('[OCR] Timecode incomplete - date not detected in OSD');
          return '';
        }

        return timestamp;
      } else {
        // Send to PaddleOCR backend for timestamp extraction via HTTP
        const response = await fetch(getApiUrl('/api/ocr/timestamp'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image,
          }),
        });

        if (!response.ok) {
          throw new Error(`OCR API error: ${response.status}`);
        }

        const result = await response.json();
        const timestamp = result.timestamp || '';

        if (!timestamp) {
          console.warn('[OCR] Timecode incomplete - date not detected in OSD');
          return '';
        }

        return timestamp;
      }
    } catch (e) {
      console.error('[OCR] Error extracting timecode:', e);
      return '';
    }
  },
};
