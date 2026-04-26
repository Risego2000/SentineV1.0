import fs from 'fs';
import path from 'path';
import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // Find the nearest directory containing .env.local (supports git worktrees)
  const findEnvDir = (start: string): string => {
    let dir = start;
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(dir, '.env.local'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return start;
  };

  // Auto-detect backend API port
  const getApiPort = (): number => {
    // Priority 1: Environment variable
    if (process.env.VITE_API_PORT) {
      return parseInt(process.env.VITE_API_PORT);
    }

    // Priority 2: Read from backend port file
    try {
      const portFile = path.join(os.tmpdir(), 'sentinel-api-port.txt');
      if (fs.existsSync(portFile)) {
        const port = parseInt(fs.readFileSync(portFile, 'utf8').trim());
        if (Number.isFinite(port)) {
          console.log(`[VITE] Auto-detected API port: ${port}`);
          return port;
        }
      }
    } catch (err) {
      console.warn(`[VITE] Could not read API port file: ${err}`);
    }

    // Priority 3: Default port
    console.log(`[VITE] Using default API port: 3002`);
    return 3002;
  };

  const apiPort = getApiPort();

  return {
    envDir: findEnvDir(__dirname),
    server: {
      port: parseInt(process.env.PORT || '3001'),
      strictPort: false,
      host: '127.0.0.1',
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
        port: 3001,
      },
      // Exclude binary/resource directories from the file watcher.
      // resources/ contains Python runtime, FFmpeg binaries and PaddleOCR models —
      // watching them causes chokidar lstat errors on locked Windows DLLs and is
      // completely unnecessary for HMR (these are not source files).
      watch: {
        ignored: [
          '**/resources/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
        ],
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            mediapipe: ['@mediapipe/tasks-vision'],
            ui: ['lucide-react'],
          },
        },
      },
    },
  };
});
