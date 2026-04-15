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
    const scanW = video.videoWidth * 0.7; // Increased to 70% to catch full date-time string even if it's long
    const scanH = video.videoHeight * 0.15; // Slightly taller to account for different font sizes and positions

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

      // OCR sometimes misinterprets numbers. Fix common issues for dates/times:
      cleanedText = cleanedText
        .replace(/Z/gi, '2')
        .replace(/O/gi, '0')
        .replace(/S/gi, '5')
        .replace(/l/g, '1')
        .replace(/I/g, '1')
        .replace(/\|/g, '1');

      // Remove common OCR noise/prefixes if they appear before the first number
      cleanedText = cleanedText.replace(/^[^0-9]+/, '');

      // Improved date match: handles DD-MM-YYYY (Spanish), YYYY-MM-DD (ISO), etc.
      let y = '',
        m = '',
        d = '';

      // Match DD-MM-YYYY or DD/MM/YYYY
      let dateMatch = cleanedText.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/);
      if (dateMatch) {
        d = dateMatch[1];
        m = dateMatch[2];
        y = dateMatch[3];
      } else {
        // Match YYYY-MM-DD
        dateMatch = cleanedText.match(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
        if (dateMatch) {
          y = dateMatch[1];
          m = dateMatch[2];
          d = dateMatch[3];
        } else {
          // Match DD-MM-YY
          dateMatch = cleanedText.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2})/);
          if (dateMatch) {
            d = dateMatch[1];
            m = dateMatch[2];
            y = dateMatch[3];
          }
        }
      }

      // Strict time match: HH:MM:SS
      const timeMatch = cleanedText.match(/(\d{2}):(\d{2}):(\d{2})/);

      if (timeMatch) {
        const timeStr = timeMatch[0];
        let dateStr = '';

        if (dateMatch) {
          d = d.padStart(2, '0');
          m = m.padStart(2, '0');
          if (y.length === 2) {
            y = `20${y}`;
          }
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
