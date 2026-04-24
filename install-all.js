#!/usr/bin/env node

/**
 * Install all dependencies for SentinelV16 Electron
 * Downloads FFmpeg and Python automatically
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n' + '='.repeat(60));
console.log('  SentinelV16 Electron - Installation Script');
console.log('='.repeat(60) + '\n');

const steps = [
  {
    name: 'Download FFmpeg',
    cmd: 'node download-ffmpeg.js',
    required: true
  },
  {
    name: 'Download Python',
    cmd: 'node download-python.js',
    required: false
  },
  {
    name: 'Install PaddleOCR',
    cmd: 'resources\\python\\python.exe -m pip install paddleocr paddlepaddle pillow',
    required: false,
    condition: () => fs.existsSync(path.join(__dirname, 'resources/python/python.exe'))
  }
];

async function runStep(step, index) {
  console.log(`\n[${index}/${steps.length}] ${step.name}`);
  console.log('-'.repeat(60));

  // Check condition if exists
  if (step.condition && !step.condition()) {
    console.log(`⚠ Skipped (dependency not ready)`);
    return { success: false, skipped: true };
  }

  try {
    console.log(`Running: ${step.cmd}\n`);
    execSync(step.cmd, {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log(`\n✓ ${step.name} completed`);
    return { success: true, skipped: false };
  } catch (error) {
    if (step.required) {
      console.error(`\n✗ ${step.name} FAILED (required)`);
      return { success: false, skipped: false, required: true };
    } else {
      console.warn(`\n⚠ ${step.name} failed (optional, continuing)`);
      return { success: false, skipped: false, required: false };
    }
  }
}

async function main() {
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const result = await runStep(steps[i], i + 1);
    results.push(result);

    if (result.required && !result.success && !result.skipped) {
      console.log('\n' + '='.repeat(60));
      console.log('Installation FAILED');
      console.log('='.repeat(60));
      process.exit(1);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Installation Summary');
  console.log('='.repeat(60));

  const completed = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;

  console.log(`Completed: ${completed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);

  if (failed === 0) {
    console.log('\n✓ Installation successful!');
    console.log('\nNext steps:');
    console.log('1. npm run test:electron   (verify everything is installed)');
    console.log('2. npm run electron        (run the app)');
    console.log('3. npm run build           (build production app)');
  } else {
    console.log('\n✗ Some installations failed. See above for details.');
  }

  console.log('');
}

main().catch(console.error);
