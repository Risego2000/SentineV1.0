/**
 * Build script for Electron main process
 * Compiles TypeScript files in electron/ directory to CommonJS
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[Build] Compiling Electron main process...');

try {
  // Create dist/electron directory if it doesn't exist
  const distDir = path.join(__dirname, 'dist/electron');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Build main.ts
  console.log('[Build] Compiling electron/main.ts...');
  esbuild.buildSync({
    entryPoints: ['electron/main.ts'],
    outfile: 'dist/electron/main.js',
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm', // Use ESM to match package.json "type": "module"
    external: ['electron'],
    // ESM-specific options
    mainFields: ['module', 'main'],
  });

  // Build preload.ts
  console.log('[Build] Compiling electron/preload.ts...');
  esbuild.buildSync({
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist/electron/preload.js',
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm', // Use ESM to match package.json "type": "module"
    external: ['electron'],
    // ESM-specific options
    mainFields: ['module', 'main'],
  });

  console.log('[Build] ✓ Electron compilation complete');
} catch (error) {
  console.error('[Build] ✗ Failed to compile Electron:', error.message);
  process.exit(1);
}
