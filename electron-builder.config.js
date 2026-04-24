/**
 * Electron Builder Configuration
 * Defines how to package and build the Electron app for distribution
 */

module.exports = {
  // App metadata
  appId: 'com.sentinel.v16',
  productName: 'SentinelV16',
  directories: {
    output: 'build',
    buildResources: 'assets',
  },

  // Files to include in final package
  files: [
    'dist/**/*',
    'electron/**/*',
    'services/**/*',
    'node_modules/**/*',
    'package.json',
    'package-lock.json',
  ],

  // Exclude unnecessary files
  extraFiles: [
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],

  // Windows configuration
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
    sign: './customSign.js',
  },

  // NSIS Installer (Windows)
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'SentinelV16',
  },

  // Linux configuration
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

  // macOS configuration
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

  // DMG (macOS installer)
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

  // Auto-updater configuration
  publish: {
    provider: 'github',
    owner: 'sentinelv16',
    repo: 'sentinelv16',
  },
};
