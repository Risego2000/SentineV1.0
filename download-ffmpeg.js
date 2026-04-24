#!/usr/bin/env node

/**
 * Download FFmpeg from GitHub BtbN Builds
 * Node.js version (more reliable than PowerShell)
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
const ffmpegDir = path.join(__dirname, 'resources', 'ffmpeg');

console.log('\nDownloading FFmpeg...');
console.log('-'.repeat(60));

async function main() {
  try {
    // Check if already exists
    const ffmpegPath = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffprobePath = path.join(ffmpegDir, 'ffprobe.exe');

    if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
      console.log('FFmpeg already installed');
      console.log(`Location: ${ffmpegDir}`);
      process.exit(0);
    }

    // Create directory
    if (!fs.existsSync(ffmpegDir)) {
      fs.mkdirSync(ffmpegDir, { recursive: true });
      console.log(`Created: ${ffmpegDir}`);
    }

    // Get latest release from GitHub API
    console.log('Finding latest FFmpeg build...');
    const releases = await fetchJSON('https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest');

    let downloadUrl = null;
    let fileName = null;

    for (const asset of releases.assets) {
      // Prefer ffmpeg-master-latest-win64-gpl.zip (not shared)
      if (asset.name === 'ffmpeg-master-latest-win64-gpl.zip') {
        downloadUrl = asset.browser_download_url;
        fileName = asset.name;
        break;
      }
    }

    // Fallback: try any win64-gpl without 'shared'
    if (!downloadUrl) {
      for (const asset of releases.assets) {
        if (asset.name.includes('win64-gpl') && !asset.name.includes('shared') && asset.name.endsWith('.zip')) {
          downloadUrl = asset.browser_download_url;
          fileName = asset.name;
          break;
        }
      }
    }

    if (!downloadUrl) {
      throw new Error('Could not find FFmpeg Windows build');
    }

    console.log(`Found: ${fileName}`);
    console.log('Downloading (~150 MB, please wait)...');

    // Download
    const tempZip = path.join(process.env.TEMP || '/tmp', 'ffmpeg-latest.zip');
    await download(downloadUrl, tempZip);
    console.log('Download complete');

    // Extract
    console.log('Extracting...');
    const tempExtract = path.join(process.env.TEMP || '/tmp', 'ffmpeg-extract');

    // Use PowerShell to extract (cross-platform)
    await execAsync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtract}' -Force"`);

    // Find and copy executables
    const files = findFilesRecursive(tempExtract, ['ffmpeg.exe', 'ffprobe.exe']);

    if (files.ffmpeg && files.ffprobe) {
      fs.copyFileSync(files.ffmpeg, path.join(ffmpegDir, 'ffmpeg.exe'));
      fs.copyFileSync(files.ffprobe, path.join(ffmpegDir, 'ffprobe.exe'));
      console.log('Extracted ffmpeg.exe and ffprobe.exe');
    } else {
      // Debug: show what was found
      console.log('Debug: Found files:', files);
      const allFiles = [];
      function listAllFiles(dir, depth = 0) {
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (depth < 5) {
              allFiles.push(`${'  '.repeat(depth)}${entry}${stat.isDirectory() ? '/' : ''}`);
              if (stat.isDirectory()) {
                listAllFiles(fullPath, depth + 1);
              }
            }
          }
        } catch (e) {}
      }
      listAllFiles(tempExtract);
      console.log('Archive structure:');
      allFiles.slice(0, 50).forEach(f => console.log(f));
      throw new Error('Could not find ffmpeg.exe and ffprobe.exe in archive');
    }

    // Cleanup
    try {
      fs.unlinkSync(tempZip);
      fs.rmSync(tempExtract, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    // Verify
    if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
      console.log('');
      console.log('SUCCESS: FFmpeg installed!');
      console.log(`Location: ${ffmpegDir}`);

      // Test version
      try {
        const { stdout } = await execAsync(`"${ffmpegPath}" -version`, { maxBuffer: 1024 * 1024 });
        const version = stdout.split('\n')[0];
        console.log(`Version: ${version}`);
      } catch (e) {
        // Ignore version check errors
      }
    } else {
      throw new Error('Installation may have failed');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.log('\nManual download: https://github.com/BtbN/FFmpeg-Builds/releases');
    console.log('Download: ffmpeg-master-latest-win64-gpl.zip');
    process.exit(1);
  }
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'SentinelV16' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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

function findFilesRecursive(dir, fileNames) {
  const result = {};

  function traverse(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (fileNames.includes(entry.toLowerCase())) {
          result[entry.split('.')[0].toLowerCase()] = fullPath;
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  traverse(dir);
  return result;
}

main();
