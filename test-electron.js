#!/usr/bin/env node

/**
 * Electron App Testing Suite
 * Validates basic Electron functionality before full testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

console.log('\n' + '='.repeat(60));
console.log('  SentinelV16 Electron - Pre-Launch Testing');
console.log('='.repeat(60) + '\n');

const tests = [];
let passed = 0;
let failed = 0;

// Test 1: Project structure
console.log('Test 1: Project Structure');
console.log('-'.repeat(60));

const requiredDirs = [
  'electron',
  'src',
  'dist/electron',
  'resources',
  'resources/ffmpeg',
  'resources/python'
];

requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ ${dir}/ exists`);
    passed++;
  } else {
    console.log(`✗ ${dir}/ missing`);
    failed++;
  }
});

console.log();

// Test 2: Electron files
console.log('Test 2: Electron Compiled Files');
console.log('-'.repeat(60));

const electronFiles = [
  'dist/electron/main.js',
  'dist/electron/preload.js'
];

electronFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✓ ${file} (${stats.size} bytes)`);
    passed++;
  } else {
    console.log(`✗ ${file} missing - run: npm run build:electron`);
    failed++;
  }
});

console.log();

// Test 3: Resources
console.log('Test 3: Runtime Resources');
console.log('-'.repeat(60));

const ffmpegPath = path.join(__dirname, 'resources/ffmpeg/ffmpeg.exe');
const pythonPath = path.join(__dirname, 'resources/python/python.exe');

if (fs.existsSync(ffmpegPath)) {
  console.log(`✓ FFmpeg found`);
  passed++;
} else {
  console.log(`✗ FFmpeg not found - run: npm run download:ffmpeg`);
  failed++;
}

if (fs.existsSync(pythonPath)) {
  console.log(`✓ Python found`);
  passed++;

  // Check PaddleOCR
  const paddleOcrPath = path.join(__dirname, 'resources/python/Lib/site-packages/paddleocr');
  if (fs.existsSync(paddleOcrPath)) {
    console.log(`✓ PaddleOCR installed`);
    passed++;
  } else {
    console.log(`⚠ PaddleOCR not installed - run: npm run install:paddleocr`);
  }
} else {
  console.log(`✗ Python not found - run: npm run download:python`);
  failed++;
}

console.log();

// Test 4: Dependencies
console.log('Test 4: npm Dependencies');
console.log('-'.repeat(60));

const packageJson = require('./package.json');
const requiredDeps = [
  'electron',
  'electron-builder',
  'esbuild',
  'react',
  'express'
];

requiredDeps.forEach(dep => {
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (allDeps[dep]) {
    console.log(`✓ ${dep} (${allDeps[dep]})`);
    passed++;
  } else {
    console.log(`✗ ${dep} not installed - run: npm install`);
    failed++;
  }
});

console.log();

// Test 5: Scripts
console.log('Test 5: npm Scripts');
console.log('-'.repeat(60));

const requiredScripts = [
  'electron',
  'build',
  'build:electron',
  'dev:electron'
];

requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    console.log(`✓ npm run ${script}`);
    passed++;
  } else {
    console.log(`✗ npm run ${script} not defined`);
    failed++;
  }
});

console.log();

// Summary
console.log('='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed === 0) {
  console.log('\n✓ All tests passed! Ready to run: npm run electron\n');
  process.exit(0);
} else {
  console.log(`\n✗ ${failed} test(s) failed. See above for details.\n`);
  process.exit(1);
}
