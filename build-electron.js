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
    outfile: 'dist/electron/main.cjs', // Use .cjs extension for CommonJS with "type": "module"
    bundle: false, // Don't bundle - rely on node_modules resolution
    platform: 'node',
    target: 'node18',
    format: 'cjs', // Use CommonJS for Electron main process compatibility
  });

  // Build preload.ts
  console.log('[Build] Compiling electron/preload.ts...');
  esbuild.buildSync({
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist/electron/preload.cjs', // Use .cjs extension for CommonJS with "type": "module"
    bundle: false, // Don't bundle - rely on node_modules resolution
    platform: 'node',
    target: 'node18',
    format: 'cjs', // Use CommonJS for Electron preload compatibility
  });

  // Build server.js (convert ESM + TS imports to CommonJS with bundling)
  console.log('[Build] Compiling server.js...');
  esbuild.buildSync({
    entryPoints: ['server.js'],
    outfile: 'dist/server.cjs', // Output as .cjs since we're converting to CommonJS
    bundle: true, // Bundle all dependencies to handle relative imports
    platform: 'node',
    target: 'node18',
    format: 'cjs', // Convert ESM to CommonJS for Node.js compatibility
    external: ['electron'], // Don't bundle electron itself
  });

  console.log('[Build] ✓ Electron compilation complete');
} catch (error) {
  console.error('[Build] ✗ Failed to compile Electron:', error.message);
  process.exit(1);
}
