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
      host: 'localhost',
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 3003, // Use fixed port 3003 since it's the Vite dev port with strictPort: false
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
