import { logger } from './logger';

/**
 * Servicio de Grabación Forense Circular.
 * Mantiene un buffer de video de los últimos N segundos.
 */
export class VideoBufferService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private readonly maxSeconds = 21; // 20 seg + 1 seg pre-roll
  private bufferCallback?: (seconds: number) => void;

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
          // Mantener solo los últimos 10 segundos (trozos de 1s).
          if (this.chunks.length > this.maxSeconds) {
            this.chunks.shift();
          }
          this.bufferCallback?.(this.chunks.length);
        }
      };
    } catch (e) {
      logger.error('RECORDER', 'Error al inicializar MediaRecorder', e);
    }
  }

  setBufferCallback(callback: (seconds: number) => void) {
    this.bufferCallback = callback;
  }

  start() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.mediaRecorder.start(1000); // Trazos de 1 segundo
      logger.info('RECORDER', 'Buffer Circular de Video Iniciado (10s)');
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  getBufferSeconds(): number {
    return this.chunks.length;
  }

  /**
   * Extrae los últimos 21 segundos del buffer.
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
