type WorkerReply =
  | { id: number; ok: true; base64: string }
  | { id: number; ok: false; error: string };

type CaptureParams = {
  video: HTMLVideoElement;
  crop: { x: number; y: number; w: number; h: number };
  out: { w: number; h: number };
  quality: number;
};

export class SnapshotCaptureWorkerClient {
  private worker: Worker | null = null;
  private seq = 1;
  private pending = new Map<
    number,
    { resolve: (value: string) => void; reject: (reason?: unknown) => void }
  >();

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../workers/snapshotCapture.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        const msg = event.data;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.base64);
        else p.reject(new Error(msg.error));
      };
    }
  }

  async captureDetail(params: CaptureParams): Promise<string> {
    if (!this.worker) throw new Error('Worker unavailable');
    const { video, crop, out, quality } = params;
    const bitmap = await createImageBitmap(video);
    const id = this.seq++;
    const result = new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage({ id, bitmap, crop, out, quality }, [bitmap]);
    return result;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

