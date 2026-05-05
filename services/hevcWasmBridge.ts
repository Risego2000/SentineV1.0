export const tryHevcWasmBridge = async (file: File): Promise<Blob | null> => {
  try {
    const ffmpegModule = await import('@ffmpeg/ffmpeg');
    const utilModule = await import('@ffmpeg/util');
    const FFmpeg = ffmpegModule.FFmpeg;
    const fetchFile = utilModule.fetchFile;
    const toBlobURL = (utilModule as { toBlobURL?: (url: string, mimeType: string) => Promise<string> })
      .toBlobURL;
    if (!FFmpeg || !fetchFile) return null;

    const ffmpeg = new FFmpeg();
    try {
      // Default load (works in most browsers)
      await ffmpeg.load();
    } catch (defaultLoadError) {
      // Electron fallback: explicit core/wasm/worker URLs via blob URLs.
      if (!toBlobURL) throw defaultLoadError;
      const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
      const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm');
      const workerURL = await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript');
      await ffmpeg.load({ coreURL, wasmURL, workerURL });
    }

    await ffmpeg.writeFile('input_video', await fetchFile(file));
    await ffmpeg.exec(['-i', 'input_video', '-c:v', 'copy', '-an', '-f', 'mp4', 'output.mp4']);

    const output = await ffmpeg.readFile('output.mp4');
    const uint8 =
      output instanceof Uint8Array
        ? output
        : output instanceof ArrayBuffer
          ? new Uint8Array(output)
          : null;

    if (!uint8 || uint8.byteLength === 0) return null;
    return new Blob([uint8], { type: 'video/mp4' });
  } catch (error) {
    console.error('[HEVC_WASM_BRIDGE] Error:', error);
    return null;
  }
};
