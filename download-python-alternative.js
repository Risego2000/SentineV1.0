#!/usr/bin/env node

/**
 * Download Python from alternative reliable source
 * Uses GitHub releases or other stable sources
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

console.log('\nDescargando Python (Fuente Alternativa)...');
console.log('-'.repeat(60));

async function main() {
  try {
    const pythonPath = path.join(pythonDir, 'python.exe');
    if (fs.existsSync(pythonPath)) {
      console.log('Python ya está instalado');
      console.log(`Ubicación: ${pythonDir}`);
      process.exit(0);
    }

    if (!fs.existsSync(pythonDir)) {
      fs.mkdirSync(pythonDir, { recursive: true });
      console.log(`Creado: ${pythonDir}`);
    }

    // URL directa de descarga confiable
    const downloadUrl = 'https://www.python.org/ftp/python/3.10.14/python-3.10.14-embed-amd64.zip';
    const fileName = 'python-3.10.14-embed-amd64.zip';

    console.log(`Descargando: ${fileName} (~50 MB, por favor espera)...`);

    const tempZip = path.join(process.env.TEMP || '/tmp', 'python-latest.zip');
    
    // Intenta descarga con reintentos
    let downloaded = false;
    for (let i = 0; i < 3; i++) {
      try {
        await download(downloadUrl, tempZip);
        downloaded = true;
        break;
      } catch (e) {
        console.log(`Intento ${i + 1} falló, reintentando...`);
        if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      }
    }

    if (!downloaded) {
      throw new Error('No se pudo descargar Python después de 3 intentos');
    }

    console.log('Descarga completada');
    console.log('Extrayendo...');
    
    const tempExtract = path.join(process.env.TEMP || '/tmp', 'python-extract');
    if (!fs.existsSync(tempExtract)) {
      fs.mkdirSync(tempExtract, { recursive: true });
    }

    await execAsync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtract}' -Force"`);

    console.log('Instalando Python...');
    copyRecursive(tempExtract, pythonDir);

    try {
      fs.unlinkSync(tempZip);
      fs.rmSync(tempExtract, { recursive: true, force: true });
    } catch (e) {}

    if (fs.existsSync(pythonPath)) {
      console.log('');
      console.log('✓ ¡Python instalado exitosamente!');
      console.log(`Ubicación: ${pythonDir}`);

      try {
        const { stdout } = await execAsync(`"${pythonPath}" --version`, { maxBuffer: 1024 * 1024 });
        console.log(`Versión: ${stdout.trim()}`);
      } catch (e) {}
    } else {
      throw new Error('Installation may have failed');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.log('\nDescarga manual alternativa:');
    console.log('1. Ve a: https://github.com/indygreg/python-build-standalone/releases');
    console.log('2. Descarga: cpython-3.10.x-x86_64-pc-windows-msvc-install_only.zip');
    console.log('3. Extrae a: resources/python/');
    process.exit(1);
  }
}

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    const file = createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'SentinelV16' } }, (res) => {
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

      pipeline(res, file).then(resolve).catch(reject);
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
