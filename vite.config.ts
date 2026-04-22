import fs from 'fs';
import path from 'path';
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

  return {
    envDir: findEnvDir(__dirname),
    server: {
      port: parseInt(process.env.PORT || '3001'),
      strictPort: false,
      host: 'localhost',
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: parseInt(process.env.PORT || '3001'),
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.VITE_API_PORT || 3002}`,
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
