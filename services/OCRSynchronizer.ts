interface OCRWorker {
  setParameters(params: { tessedit_char_whitelist: string }): Promise<void>;
  recognize(image: HTMLCanvasElement): Promise<{
    data: {
      text: string;
    };
  }>;
}

interface PlateOCRResult {
  plate: string;
  candidates: string[];
}

/**
 * Service to synchronize video playback time with visual timecodes (OSD).
 */
export const OCRSynchronizer = {
  privateWorker: null as OCRWorker | null,

  async init() {
    if (!this.privateWorker) {
      const { createWorker } = await import('tesseract.js');
      this.privateWorker = await createWorker('eng'); // Assuming numbers/time are eng-like
      await this.privateWorker.setParameters({
        tessedit_char_whitelist:
          '0123456789:/- ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', // Include letters for 'Wed', etc.
      });
    }
    return this.privateWorker;
  },

  async base64ToCanvas(base64: string): Promise<HTMLCanvasElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0);
        resolve(canvas);
      };
      image.onerror = () => resolve(null);
      image.src = base64.startsWith('data:image') ? base64 : `data:image/jpeg;base64,${base64}`;
    });
  },

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
      const worker = await this.init();
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
      });

      const normalizedCandidates: string[] = [];

      for (const frame of zoomFrames.slice(0, 3)) {
        const canvas = await this.base64ToCanvas(frame);
        if (!canvas) continue;

        const {
          data: { text },
        } = await worker.recognize(canvas);

        const normalized = this.normalizePlate(text);
        if (normalized) normalizedCandidates.push(normalized);
      }

      const uniqueCandidates = [...new Set(normalizedCandidates)];
      const bestCandidate =
        uniqueCandidates.sort((a, b) => {
          const score = (value: string) =>
            normalizedCandidates.filter((candidate) => candidate === value).length;
          return score(b) - score(a) || b.length - a.length;
        })[0] || '';

      return {
        plate: bestCandidate,
        candidates: uniqueCandidates,
      };
    } catch (e) {
      console.error('[OCR] Error extracting license plate:', e);
      return { plate: '', candidates: [] };
    }
  },

  /**
   * Captures a region of the video and returns OCR text.
   * Default region is top-left (15% of width, 10% of height).
   */
  async extractTimecode(video: HTMLVideoElement): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Define OSD Region (Top-Left Focus)
    const scanW = video.videoWidth * 0.35; // Slightly wider to catch full date-time string
    const scanH = video.videoHeight * 0.08; // Slightly shorter to focus on the top line

    canvas.width = scanW;
    canvas.height = scanH;

    // Draw region to canvas (Top-Left)
    ctx.drawImage(video, 0, 0, scanW, scanH, 0, 0, scanW, scanH);

    // Run OCR
    try {
      const worker = await this.init();
      await worker.setParameters({
        tessedit_char_whitelist:
          '0123456789:/- ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      });
      const {
        data: { text },
      } = await worker.recognize(canvas);
      let cleanedText = text.trim();

      // Remove common OCR noise/prefixes if they appear before the first number
      cleanedText = cleanedText.replace(/^[^0-9]+/, '');

      // Flexible date match: finds 3 groups of numbers (2, 2, 4 digits typically)
      // This handles 12-11-2025, 12/11/2025, or even 12.11.2025
      const dateMatch = cleanedText.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);

      // Strict time match: HH:MM:SS
      const timeMatch = cleanedText.match(/(\d{2}):(\d{2}):(\d{2})/);

      if (timeMatch) {
        const timeStr = timeMatch[0];
        let dateStr = '';

        if (dateMatch) {
          const d = dateMatch[1].padStart(2, '0');
          const m = dateMatch[2].padStart(2, '0');
          const y = dateMatch[3];
          dateStr = `${d}/${m}/${y}`;
        } else {
          // Forense: NO fabricamos fecha - eso compromete la validez forense
          dateStr = '??/??/????';
          console.warn('[OCR] Timecode incomplete - date not detected in OSD');
        }

        return `${dateStr}, ${timeStr}`;
      }

      return cleanedText;
    } catch (e) {
      console.error('[OCR] Error extracting timecode:', e);
      return '';
    }
  },
};
