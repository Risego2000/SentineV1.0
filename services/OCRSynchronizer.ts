import { getApiUrl } from './apiConfig';

interface PlateOCRResult {
  plate: string;
  candidates: string[];
}

/**
 * Service for OCR processing using PaddleOCR backend.
 * All OCR operations now use the backend service for better accuracy and performance.
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
      // Send to PaddleOCR backend for processing
      const response = await fetch(getApiUrl('/api/ocr/plate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: zoomFrames.slice(0, 10),
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status}`);
      }

      const result = await response.json();
      const plate = result.plate || '';
      const candidates = result.candidates || [];

      return {
        plate,
        candidates,
      };
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
      // Send to PaddleOCR backend for timestamp extraction
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
    } catch (e) {
      console.error('[OCR] Error extracting timecode:', e);
      return '';
    }
  },
};
