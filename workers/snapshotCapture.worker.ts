type CaptureRequest = {
  id: number;
  bitmap: ImageBitmap;
  crop: { x: number; y: number; w: number; h: number };
  out: { w: number; h: number };
  quality: number;
};

type CaptureResponse =
  | { id: number; ok: true; base64: string }
  | { id: number; ok: false; error: string };

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
};

self.onmessage = async (event: MessageEvent<CaptureRequest>) => {
  const { id, bitmap, crop, out, quality } = event.data;
  try {
    const canvas = new OffscreenCanvas(out.w, out.h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable in worker');

    ctx.clearRect(0, 0, out.w, out.h);
    ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, out.w, out.h);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: Math.max(0.5, Math.min(0.95, quality)),
    });
    const base64 = await blobToBase64(blob);
    const payload: CaptureResponse = { id, ok: true, base64 };
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payload: CaptureResponse = { id, ok: false, error: message };
    (self as DedicatedWorkerGlobalScope).postMessage(payload);
  }
};

