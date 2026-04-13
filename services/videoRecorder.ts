import { logger } from './logger';

/**
 * Servicio de Grabación Forense Circular.
 * Mantiene un buffer de video de los últimos N segundos.
 */
export class VideoBufferService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private onBufferUpdate?: (seconds: number) => void;
  private readonly maxSeconds = 20; // Buffer exactly 20 seconds

  constructor(canvas: HTMLCanvasElement) {
    try {
      this.stream = canvas.captureStream(30); // 30 FPS
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
          // Mantener solo los últimos 20 segundos (trozos de 1s).
          if (this.chunks.length > this.maxSeconds) {
            this.chunks.shift();
          }
          this.onBufferUpdate?.(this.chunks.length);
        }
      };
    } catch (e) {
      logger.error('RECORDER', 'Error al inicializar MediaRecorder', e);
    }
  }

  start() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.mediaRecorder.start(1000); // Trazos de 1 segundo
      logger.info('RECORDER', 'Buffer Circular de Video Iniciado (20s)');
      this.onBufferUpdate?.(this.chunks.length);
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  setBufferCallback(callback: (seconds: number) => void) {
    this.onBufferUpdate = callback;
  }

  getBufferSeconds(): number {
    return this.chunks.length;
  }

  /**
   * Extrae los últimos 20 segundos del buffer.
   */
  async getClip(): Promise<string> {
    return new Promise((resolve) => {
      const clipChunks = this.chunks.slice(-this.maxSeconds);
      if (clipChunks.length === 0) {
        resolve('');
        return;
      }

      const blob = new Blob(clipChunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }
}
