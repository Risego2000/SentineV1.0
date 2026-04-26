/**
 * Electron Builder Configuration (TypeScript)
 * Consolidates development and production build settings
 * PHASE 4: Unified electron-builder configuration
 */

import path from 'path';

const isDev = process.env.NODE_ENV === 'development';
const platform = process.platform;

const config = {
  // App metadata
  appId: 'com.sentinel-ai.app',
  productName: 'Sentinel AI',

  // Directory configuration
  directories: {
    output: path.join(__dirname, 'dist'),
    buildResources: path.join(__dirname, 'resources'),
  },

  // Files to include in packaged app
  files: [
    'dist/**/*',
    'node_modules/**/*',
    'package.json',
    'package-lock.json',
  ],

  // Additional resources to bundle
  extraFiles: [
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],

  // Asar archive for security and reduced size
  asar: !isDev, // Disable in development for easier debugging
  asarUnpack: ['resources/**/*'], // Unpack resources for runtime access

  // Windows build configuration
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    certificateFile: process.env.WIN_SIGNING_CERT,
    certificatePassword: process.env.WIN_SIGNING_PASSWORD,
    signingHashAlgorithms: ['sha256'],
  },

  // NSIS installer (Windows)
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Sentinel AI',
  },

  // Portable executable (Windows)
  portable: {
    artifactName: '${productName}-${version}-portable.${ext}',
  },

  // Linux build configuration
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'deb',
        arch: ['x64'],
      },
    ],
    category: 'Utility',
  },

  // macOS build configuration
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },

  // DMG installer (macOS)
  dmg: {
    contents: [
      {
        x: 130,
        y: 220,
        type: 'file',
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications',
      },
    ],
  },

  // Auto-updates (disabled for now, use manual versioning)
  publish: null,
};

export default config;
