import { logger } from './logger';

/**
 * Servicio de Grabación Forense.
 * Modos de operación:
 * - CIRCULAR: mantiene buffer de los últimos N segundos (siempre activo)
 * - ROI_BASED: inicia en ROI A, termina en ROI B (duración determinada por buffer)
 */
export class VideoBufferService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private readonly maxSeconds = 21;
  private bufferCallback?: (seconds: number) => void;
  private mode: 'circular' | 'roi_based' = 'circular';
  private recordingStartTime: number = 0;
  private isRecording = false;

  constructor(canvas: HTMLCanvasElement, mode: 'circular' | 'roi_based' = 'circular') {
    this.mode = mode;
    try {
      this.stream = canvas.captureStream(30);

      const mimeTypes = [
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4',
      ];

      const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

      if (!mimeType) {
        throw new Error('No supported mimeType found for MediaRecorder');
      }

      logger.info(
        'RECORDER',
        `Inicializando MediaRecorder en modo ${mode} con mimeType: ${mimeType}`
      );

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          if (this.mode === 'circular') {
            this.chunks.push(e.data);
            if (this.chunks.length > this.maxSeconds) {
              this.chunks.shift();
            }
          } else if (this.isRecording) {
            const elapsed = (Date.now() - this.recordingStartTime) / 1000;
            if (elapsed <= this.maxSeconds) {
              this.chunks.push(e.data);
            }
          }
          this.bufferCallback?.(this.chunks.length);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        logger.error('RECORDER', 'Error en MediaRecorder', event);
      };

      this.mediaRecorder.onstop = () => {
        logger.info('RECORDER', 'MediaRecorder detenido');
      };
    } catch (e) {
      logger.error('RECORDER', 'Error al inicializar MediaRecorder', e);
    }
  }

  setBufferCallback(callback: (seconds: number) => void) {
    this.bufferCallback = callback;
  }

  /**
   * Inicia grabación (modo circular) o marca inicio en ROI A (modo roi_based).
   */
  start() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      if (this.mode === 'roi_based') {
        this.chunks = [];
        this.recordingStartTime = Date.now();
        this.isRecording = true;
        logger.info('RECORDER', 'Grabación iniciada en ROI A');
      } else {
        logger.info('RECORDER', 'Buffer Circular de Video Iniciado');
      }
      this.mediaRecorder.start(1000);
    }
  }

  /**
   * Detiene grabación (modo circular) o marca fin en ROI B (modo roi_based).
   */
  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      if (this.mode === 'roi_based') {
        this.isRecording = false;
        const elapsed = ((Date.now() - this.recordingStartTime) / 1000).toFixed(1);
        logger.info(`RECORDER', 'Grabación finalizada en ROI B (duración: ${elapsed}s)`);
      }
      this.mediaRecorder.stop();
    }
  }

  getBufferSeconds(): number {
    if (this.mode === 'roi_based' && this.isRecording) {
      return (Date.now() - this.recordingStartTime) / 1000;
    }
    return this.chunks.length;
  }

  /**
   * Extrae el clip: modo circular = últimos 21 seg, modo roi_based = desde inicio hasta stop.
   */
  async getClip(): Promise<string> {
    return new Promise((resolve) => {
      let clipChunks: Blob[];

      if (this.mode === 'circular') {
        clipChunks = this.chunks.slice(-this.maxSeconds);
      } else {
        clipChunks = this.chunks;
      }

      if (clipChunks.length === 0) {
        resolve('');
        return;
      }

      const mimeType = this.mediaRecorder?.mimeType || 'video/mp4';
      const blob = new Blob(clipChunks, { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }
}
