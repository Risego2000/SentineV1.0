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
          target: 'http://localhost:3002',
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
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('@mediapipe/tasks-vision')) return 'mediapipe';
            if (id.includes('@supabase/supabase-js')) return 'supabase';
            if (id.includes('tesseract.js')) return 'tesseract';
            if (id.includes('lucide-react')) return 'ui';
            if (id.includes('zustand')) return 'state';
            if (id.includes('jspdf')) return 'pdf';
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';

            return 'vendor';
          },
        },
      },
    },
  };
});
