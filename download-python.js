#!/usr/bin/env node

/**
 * Download Python Embedded from python.org
 * Python 3.10 embeddable package for Windows x64
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pythonDir = path.join(__dirname, 'resources', 'python');

function checkUrl(url) {
  return new Promise((resolve) => {
    https.head(url, { timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    }).on('error', () => resolve(false));
  });
}

console.log('\nDownloading Python...');
console.log('-'.repeat(60));

async function main() {
  try {
    // Check if already exists
    const pythonPath = path.join(pythonDir, 'python.exe');

    if (fs.existsSync(pythonPath)) {
      console.log('Python already installed');
      console.log(`Location: ${pythonDir}`);
      process.exit(0);
    }

    // Create directory
    if (!fs.existsSync(pythonDir)) {
      fs.mkdirSync(pythonDir, { recursive: true });
      console.log(`Created: ${pythonDir}`);
    }

    // Try multiple URLs for Python 3.10 embeddable
    const urls = [
      'https://www.python.org/ftp/python/3.10.13/python-3.10.13-embed-amd64.zip',
      'https://www.python.org/ftp/python/3.10.14/python-3.10.14-embed-amd64.zip', // Try 3.10.14
      'https://www.python.org/ftp/python/3.11.0/python-3.11.0-embed-amd64.zip'    // Try 3.11
    ];

    let downloadUrl = null;
    let fileName = null;

    for (const url of urls) {
      const name = url.split('/').pop();
      console.log(`Trying: ${name}`);
      try {
        const exists = await checkUrl(url);
        if (exists) {
          downloadUrl = url;
          fileName = name;
          console.log(`✓ Found: ${fileName}\n`);
          break;
        }
      } catch (e) {
        // Continue to next URL
      }
    }

    if (!downloadUrl) {
      throw new Error('Could not find Python embeddable package. See manual installation below.');
    }

    console.log(`Downloading: ${fileName} (~50 MB, please wait)...`);

    // Download
    const tempZip = path.join(process.env.TEMP || '/tmp', 'python-latest.zip');
    await download(downloadUrl, tempZip);
    console.log('Download complete');

    // Extract
    console.log('Extracting...');
    const tempExtract = path.join(process.env.TEMP || '/tmp', 'python-extract');

    if (!fs.existsSync(tempExtract)) {
      fs.mkdirSync(tempExtract, { recursive: true });
    }

    // Use PowerShell to extract
    await execAsync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtract}' -Force"`);

    // Copy all files from extraction to python directory
    console.log('Installing Python...');
    copyRecursive(tempExtract, pythonDir);

    // Cleanup
    try {
      fs.unlinkSync(tempZip);
      fs.rmSync(tempExtract, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    // Verify
    if (fs.existsSync(pythonPath)) {
      console.log('');
      console.log('SUCCESS: Python installed!');
      console.log(`Location: ${pythonDir}`);

      // Test version
      try {
        const { stdout } = await execAsync(`"${pythonPath}" --version`, { maxBuffer: 1024 * 1024 });
        console.log(`Version: ${stdout.trim()}`);
      } catch (e) {
        // Ignore version check errors
      }
    } else {
      throw new Error('Installation may have failed');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.log('\nManual download: https://www.python.org/downloads/windows/');
    console.log('Download: Python 3.10.13 Windows embeddable package (64-bit)');
    console.log('Extract to: resources/python/');
    process.exit(1);
  }
}

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many redirects'));
    }

    const file = createWriteStream(dest);
    https.get(url, {
      headers: { 'User-Agent': 'SentinelV16' }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }

      pipeline(res, file)
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main();
