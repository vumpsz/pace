const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron')
const path = require('path')

const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0b0d11',
    title: 'Pace',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  return win
}

app.whenReady().then(() => {
  // JSON export: ask where to save instead of silently dropping into Downloads.
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const win = BrowserWindow.fromWebContents(webContents)
    const target = dialog.showSaveDialogSync(win, {
      title: 'Save backup',
      defaultPath: path.join(app.getPath('documents'), item.getFilename()),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (target) item.setSavePath(target)
    else item.cancel()
  })

  const template = [
    {
      label: 'Pace',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
