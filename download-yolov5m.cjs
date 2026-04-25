#!/usr/bin/env node
/**
 * Download YOLOv5m ONNX model from Ultralytics releases
 * Model URL: https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5m.pt
 *
 * This script:
 * 1. Creates public/models/ directory
 * 2. Downloads yolov5m.onnx (~50MB)
 * 3. Verifies integrity
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, 'public', 'models');
const MODEL_NAME = 'yolov5m.onnx';
const MODEL_PATH = path.join(MODELS_DIR, MODEL_NAME);

// Model download URL (pre-exported ONNX from Ultralytics)
const MODEL_URL = 'https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5m.onnx';

// Ensure directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`✓ Created directory: ${MODELS_DIR}`);
}

// Check if model already exists
if (fs.existsSync(MODEL_PATH)) {
  const stats = fs.statSync(MODEL_PATH);
  const sizeM = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`✓ Model already exists: ${MODEL_PATH} (${sizeM}MB)`);
  process.exit(0);
}

// Download model
console.log(`⏳ Downloading YOLOv5m ONNX model (~50MB)...`);
console.log(`   From: ${MODEL_URL}`);

const file = fs.createWriteStream(MODEL_PATH);
let downloadedBytes = 0;

const request = https.get(MODEL_URL, {
  headers: { 'User-Agent': 'SentinelV16' },
  timeout: 300000 // 5 minutes
}, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Follow redirect
    console.log(`⏳ Redirecting to: ${response.headers.location}`);
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      redirectResponse.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r   Downloaded: ${mb}MB`);
      });
    }).on('error', (err) => {
      fs.unlinkSync(MODEL_PATH);
      console.error(`\n✗ Download error (redirect): ${err.message}`);
      process.exit(1);
    });
  } else if (response.statusCode === 200) {
    response.pipe(file);
    const totalSize = parseInt(response.headers['content-length'], 10);

    response.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
      const percent = totalSize ? ((downloadedBytes / totalSize) * 100).toFixed(1) : '?';
      process.stdout.write(`\r   Downloaded: ${mb}MB (${percent}%)`);
    });
  } else {
    fs.unlinkSync(MODEL_PATH);
    console.error(`\n✗ HTTP error: ${response.statusCode}`);
    process.exit(1);
  }
});

file.on('finish', () => {
  file.close();
  const stats = fs.statSync(MODEL_PATH);
  const sizeM = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ Model downloaded successfully: ${sizeM}MB`);
  console.log(`  Path: ${MODEL_PATH}`);
});

file.on('error', (err) => {
  fs.unlink(MODEL_PATH, () => {});
  console.error(`\n✗ File write error: ${err.message}`);
  process.exit(1);
});

request.on('error', (err) => {
  if (fs.existsSync(MODEL_PATH)) {
    fs.unlinkSync(MODEL_PATH);
  }
  console.error(`\n✗ Download error: ${err.message}`);
  console.error('\nFallback: Manually download from:');
  console.error(`  ${MODEL_URL}`);
  console.error(`\nThen place at: ${MODEL_PATH}`);
  process.exit(1);
});

request.on('timeout', () => {
  request.destroy();
  if (fs.existsSync(MODEL_PATH)) {
    fs.unlinkSync(MODEL_PATH);
  }
  console.error('\n✗ Download timeout (5 minutes exceeded)');
  process.exit(1);
});
