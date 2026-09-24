const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Menu, session, powerSaveBlocker, screen, Tray, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { createStorage, validateState, MAX_BYTES } = require('./storage.cjs')
const { createMedia } = require('./media.cjs')
const { createWidget } = require('./widget.cjs')

// Test runs use their own directory and never touch a person's training history.
if (process.env.OPENGYM_TEST_DATA && !app.isPackaged) app.setPath('userData', path.resolve(process.env.OPENGYM_TEST_DATA))
protocol.registerSchemesAsPrivileged([{ scheme: 'opengym', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])
const single = app.requestSingleInstanceLock()
if (!single) { app.quit() } else {
  let win, storage, media, closing = false, awake = null, widgetController = null, quitting = false
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })
  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', () => widgetController?.dispose())
  app.on('window-all-closed', () => app.quit())
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.natural0101.opengym')
    const dataDir = app.getPath('userData'), dist = path.join(__dirname, '../frontend/dist')
    storage = createStorage(dataDir)
    const mediaDir = path.join(dataDir, 'media')
    const manifest = JSON.parse(await fs.readFile(path.join(dist, 'desktop-media.json'), 'utf8'))
    media = createMedia(mediaDir, manifest, state => { if (win && !win.isDestroyed()) win.webContents.send('desktop:media-progress', state) })
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"
    protocol.handle('opengym', async request => {
      try {
        const url = new URL(request.url)
        if (url.host !== 'app') return new Response('Not found', { status: 404 })
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
        const isMedia = /^(img|gif)\//.test(relative)
        const root = isMedia ? mediaDir : dist
        const target = path.resolve(root, relative)
        if (!target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 })
        try {
          await fs.access(target)
          const response = await net.fetch(pathToFileURL(target).toString())
          const headers = new Headers(response.headers)
          headers.set('Content-Security-Policy', csp)
          return new Response(response.body, { status: response.status, headers })
        } catch {
          if (isMedia) return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><rect width="320" height="220" rx="12" fill="#f0f1f2"/><g fill="none" stroke="#8c959f" stroke-width="6" stroke-linecap="round"><path d="M133 110h54m-54-21v42m54-42v42m-66-32v22m78-22v22"/></g><text x="160" y="166" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#656d76">Медиа не загружено</text></svg>', { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } })
          return new Response('Not found', { status: 404 })
        }
      } catch { return new Response('Bad request', { status: 400 }) }
    })
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
      if (!event.senderFrame || !event.senderFrame.url.startsWith('opengym://app/')) throw new Error('Untrusted frame')
      return fn(...args)
    })
    handle('desktop:load', () => storage.read())
    handle('desktop:save', state => {
      validateState(state)
      if (state.active && state.keepAwake !== false && awake == null) awake = powerSaveBlocker.start('prevent-display-sleep')
      if ((!state.active || state.keepAwake === false) && awake != null) { powerSaveBlocker.stop(awake); awake = null }
      return storage.write(state)
    })
    handle('desktop:info', () => ({ version: app.getVersion(), dataDir, backupDir: storage.backupDir, packaged: app.isPackaged }))
    handle('desktop:folder', () => shell.openPath(dataDir))
    handle('desktop:export', async () => {
      await storage.flush()
      const { state } = await storage.read()
      if (!state) throw new Error('Пока нет данных для экспорта.')
      const result = await dialog.showSaveDialog(win, { title: 'Сохранить резервную копию', defaultPath: `openGym-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'openGym backup', extensions: ['json'] }] })
      if (result.canceled) return { canceled: true }
      await fs.writeFile(result.filePath, validateState(state), 'utf8')
      return { canceled: false }
    })
    handle('desktop:import', async () => {
      const result = await dialog.showOpenDialog(win, { title: 'Выбрать резервную копию', filters: [{ name: 'openGym backup', extensions: ['json'] }], properties: ['openFile'] })
      if (result.canceled) return null
      const file = result.filePaths[0]
      if ((await fs.stat(file)).size > MAX_BYTES) throw new Error('Файл превышает 20 МБ.')
      const state = JSON.parse(await fs.readFile(file, 'utf8')); validateState(state)
      return state
    })
    handle('desktop:restore', async state => { await storage.write(state, true); return state })
    handle('desktop:print-plan', async html => {
      if (typeof html !== 'string' || Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error('Некорректный план.')
      const result = await dialog.showSaveDialog(win, { title: 'Сохранить план в PDF', defaultPath: 'openGym-plan.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
      if (result.canceled) return { canceled: true }
      const printWindow = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false } })
      try {
        const safe = html.replace(/<head[^>]*>/i, '<head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;">')
        await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(safe))
        const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
        await fs.writeFile(result.filePath, pdf)
        return { canceled: false }
      } finally { printWindow.destroy() }
    })
    handle('desktop:media-status', () => media.inspect())
    handle('desktop:media-start', () => { void media.start(); return media.status() })
    handle('desktop:media-stop', () => media.stop())
    Menu.setApplicationMenu(null)
    win = new BrowserWindow({
      width: 1380, height: 920, minWidth: 800, minHeight: 600, title: 'openGym', backgroundColor: '#fafafa',
      icon: path.join(dist, 'icon-512.png'), show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
    })
    widgetController = createWidget({ app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, mainWindow: win, dist })
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\/(github\.com|opengym\.duarte-santos\.ch)\//.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('opengym://app/')) event.preventDefault() })
    win.webContents.on('will-attach-webview', event => event.preventDefault())
    win.once('ready-to-show', () => win.show())
    win.on('close', event => {
      if (closing) return
      event.preventDefault()
      // Renderer saves are immediate IPC calls, not a delayed debounce; flush queued disk writes.
      Promise.all([storage.flush(), widgetController.flush()]).then(() => { if (!quitting && widgetController.isVisible()) { win.hide(); return }; closing = true; media.stop(); widgetController.dispose(); win.close() }).catch(async error => {
        const { response } = await dialog.showMessageBox(win, { type: 'warning', title: 'Данные не сохранены', message: error.message, buttons: ['Вернуться', 'Закрыть без сохранения'], defaultId: 0, cancelId: 0 })
        if (response === 1) { closing = true; win.close() }
      })
    })
    await win.loadURL('opengym://app/index.html')
    await widgetController.restore()
  }).catch(error => { dialog.showErrorBox('openGym — ошибка запуска', error.message); app.quit() })
}
