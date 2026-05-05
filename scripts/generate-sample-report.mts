import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class MemoryStorage {
  #store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, value);
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }
}

class NodeFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  async readAsDataURL(blob: Blob): Promise<void> {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      this.onloadend?.();
    } catch {
      this.onerror?.();
    }
  }
}

const originalFetch = globalThis.fetch.bind(globalThis);

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
});

Object.defineProperty(globalThis, 'FileReader', {
  value: NodeFileReader,
  configurable: true,
});

const atobPolyfill = (input: string) => Buffer.from(input, 'base64').toString('binary');
const btoaPolyfill = (input: string) => Buffer.from(input, 'binary').toString('base64');

const windowPolyfill = {
  location: {
    protocol: 'http:',
    hostname: 'localhost',
    port: '3002',
  },
  atob: atobPolyfill,
  btoa: btoaPolyfill,
};

Object.defineProperty(globalThis, 'window', {
  value: windowPolyfill,
  configurable: true,
});

Object.defineProperty(globalThis, 'atob', {
  value: atobPolyfill,
  configurable: true,
});

Object.defineProperty(globalThis, 'btoa', {
  value: btoaPolyfill,
  configurable: true,
});

Object.defineProperty(globalThis, 'fetch', {
  value: async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      const localPath = path.join(rootDir, 'public', input.replace(/^\//, ''));
      const bytes = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const type =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';

      return {
        ok: true,
        status: 200,
        blob: async () => new Blob([bytes], { type }),
      };
    }

    return originalFetch(input as never, init);
  },
  configurable: true,
});

const toDataUrl = async (relativePath: string): Promise<string> => {
  const absolutePath = path.join(rootDir, relativePath);
  const bytes = await fs.readFile(absolutePath);
  const ext = path.extname(relativePath).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
};

const sampleImage = await toDataUrl(path.join('public', 'multas_dgt.jpg'));
const sampleImageAlt = await toDataUrl(path.join('public', 'multas_dgt (1).jpg'));
const { ReportService } = await import('../services/ReportService.ts');

const sampleLog = {
  id: 84721,
  image: sampleImage,
  extraSnapshots: [sampleImage, sampleImageAlt, sampleImage],
  zoomSnapshots: [sampleImageAlt, sampleImage, sampleImageAlt],
  ocrResults: ['1234MNB', '1234 MNB', '1234MNB'],
  plateOcr: '1234MNB',
  plateOcrCandidates: ['1234MNB', '1234 MNB', 'I234MNB'],
  videoClip: 'available',
  time: '2026-04-24T18:42:11',
  playbackTime: 132.48,
  viewerId: 'Principal',
  validationStatus: 'validated',
  validatedAt: new Date('2026-04-24T18:42:19').getTime(),
  operatorId: 'Sentinel AI',
  plate: '1234 MNB',
  makeModel: 'SEAT Leon',
  color: 'Gris',
  description:
    'El vehículo matrícula 1234 MNB accede a una secuencia de giro prohibida, invade el área restringida y completa la maniobra en sentido no autorizado. La infracción queda registrada por Sentinel AI mediante secuencia de imágenes, OCR y validación forense automática.',
  severity: 'HIGH',
  ruleCategory: 'Giro prohibido',
  legalBase: 'Art. 76 TRLTSV / Ordenanza municipal aplicable',
  reasoning: [
    'El vehículo entra en la secuencia ROI restringida.',
    'La trayectoria confirma el giro no autorizado.',
    'El OCR mantiene consistencia en varios fotogramas.',
  ],
  visualTimestamp: '2026-04-24T18:42:11.233Z',
  videoTimeCode: '18:42:11',
  localTime: '24/04/2026 18:42:11',
  telemetry: {
    speedEstimated: '47 km/h',
    behaviorAnomalies: 'Giro no permitido detectado',
  },
} as const;

const outputDir = path.join(rootDir, 'public', 'generated');
await fs.mkdir(outputDir, { recursive: true });

const outputName = process.env.OUTPUT_NAME || 'Ejemplo_Boletin_Denuncia_Sentinel.pdf';
const pdfBuffer = await ReportService.generateInfractionPdf(sampleLog as never, outputName);
await fs.writeFile(path.join(outputDir, outputName), Buffer.from(pdfBuffer));

console.log(path.join(outputDir, outputName));
