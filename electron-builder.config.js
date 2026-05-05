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
  files: ['dist/**/*', 'node_modules/**/*', 'package.json', 'package-lock.json'],

  // Additional files/resources to bundle
  extraFiles: [
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],

  // Asar archive (package.asar) for improved security and size
  asar: true,
  asarUnpack: ['resources/**/*'], // Unpack resources so they can be accessed

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
    // Signing configuration (optional, only used if environment variables are set)
    certificateFile: process.env.WIN_SIGNING_CERT || undefined,
    certificatePassword: process.env.WIN_SIGNING_PASSWORD || undefined,
    signingHashAlgorithms: ['sha256'],
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
};
