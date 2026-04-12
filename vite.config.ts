import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteTranscodePlugin } from './plugins/viteTranscodePlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      strictPort: true,
      host: 'localhost',
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 3001,
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
    plugins: [react(), viteTranscodePlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_GENAI_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENAI_KEY),
    },
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
