// electron-builder configuration.
// Uses the already-downloaded Electron in node_modules when present (avoids a
// second download and a rename issue seen under some Windows folders); on CI
// or a fresh clone electron-builder fetches Electron itself.
const fs = require('fs')
const path = require('path')

const localDist = path.join(__dirname, 'node_modules', 'electron', 'dist')
const hasLocalDist = fs.existsSync(path.join(localDist, process.platform === 'win32' ? 'electron.exe' : 'electron'))

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.pace.tracker',
  productName: 'Pace',
  directories: { output: 'release', buildResources: 'build' },
  // The GitHub Actions workflow attaches the files to the release; never let electron-builder publish.
  publish: null,
  files: ['dist/**', 'electron/**', 'build/icon.png', 'package.json'],
  ...(hasLocalDist ? { electronDist: localDist } : {}),
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'build/icon.png',
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Pace',
    artifactName: 'Pace-Setup-${version}.${ext}',
  },
  portable: { artifactName: 'Pace-Portable-${version}.${ext}' },
}
