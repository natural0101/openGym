const path = require('node:path')
const { attachToDesktop, isOnDesktop } = require('./desktop-host.cjs')
const fs = require('node:fs/promises')

// A read-only companion window. All training mutations stay in the main renderer/store.
function createWidget({ app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, mainWindow, dist }) {
  let widget = null, tray = null, prefs = { visible: false }, moveTimer = null
  let state = { name: 'Тренировка дома', active: false, buddy: 'burger', done: 0, total: 0, timer: null, burger: { remaining: 100, won: false, scale: 0.9 } }
  const prefsFile = path.join(app.getPath('userData'), 'widget-preferences.json')
  let writes = Promise.resolve()
  const remember = () => {
    const text = JSON.stringify(prefs)
    writes = writes.catch(() => {}).then(async () => { await fs.writeFile(prefsFile + '.tmp', text); await fs.rename(prefsFile + '.tmp', prefsFile) }).catch(() => {})
  }
  const presentMain = () => { if (!mainWindow.isDestroyed()) { mainWindow.show(); if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() } }
  const publish = () => { if (widget && !widget.isDestroyed()) widget.webContents.send('widget:state', { ...state, onDesktop: isOnDesktop(widget) }) }
  const ensureTray = () => {
    if (tray) return
    tray = new Tray(nativeImage.createFromPath(path.join(dist, 'desktop-icon-512.png')).resize({ width: 20, height: 20 }))
    tray.setToolTip('openGym — домашние тренировки')
    tray.on('double-click', presentMain)
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть openGym', click: presentMain },
      { label: 'Показать виджет', click: () => { void show() } },
      { type: 'separator' }, { label: 'Выйти', click: () => app.quit() },
    ]))
  }
  const show = async () => {
    prefs.visible = true; remember(); ensureTray()
    if (widget && !widget.isDestroyed()) { attachToDesktop(widget); publish(); return }
    const area = screen.getDisplayNearestPoint({ x: Number.isFinite(prefs.x) ? prefs.x : screen.getPrimaryDisplay().workArea.x, y: Number.isFinite(prefs.y) ? prefs.y : screen.getPrimaryDisplay().workArea.y }).workArea
    const width = 318, height = 540
    const x = Math.max(area.x, Math.min(Number.isFinite(prefs.x) ? prefs.x : area.x + area.width - width - 24, area.x + area.width - width))
    const y = Math.max(area.y, Math.min(Number.isFinite(prefs.y) ? prefs.y : area.y + area.height - height - 24, area.y + area.height - height))
    widget = new BrowserWindow({ width, height, x, y, title: 'openGym · напарники', frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: false, show: false,
      webPreferences: { preload: path.join(__dirname, 'widget-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } })
    widget.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    widget.webContents.on('will-navigate', event => event.preventDefault())
    widget.on('move', () => { clearTimeout(moveTimer); moveTimer = setTimeout(() => { if (!widget || widget.isDestroyed()) return; const [px,py] = widget.getPosition(); prefs.x = px; prefs.y = py; remember() }, 250) })
    widget.on('closed', () => { widget = null })
    await widget.loadURL('opengym://app/widget/index.html')
    try { attachToDesktop(widget); publish() } catch (error) { widget.destroy(); prefs.visible = false; remember(); throw error }
  }
  const fromMain = event => event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame
  const fromWidget = event => widget && event.sender === widget.webContents && event.senderFrame === widget.webContents.mainFrame
  ipcMain.handle('desktop:widget-show', event => { if (!fromMain(event)) throw new Error('Untrusted sender'); return show() })
  ipcMain.handle('desktop:widget-update', (event, value) => {
    if (!fromMain(event)) throw new Error('Untrusted sender')
    if (!value || typeof value.name !== 'string' || !Number.isFinite(value.done) || !Number.isFinite(value.total)) throw new Error('Invalid widget state')
    state = { name: value.name.slice(0, 160), active: value.active === true, buddy: value.buddy === 'cake' ? 'cake' : 'burger', done: Math.max(0,value.done), total: Math.max(0,value.total),
      burger: value.burger && Number.isFinite(value.burger.remaining) ? { remaining: Math.max(0, Math.min(150, value.burger.remaining)), won: value.burger.won === true, scale: Math.max(0, Math.min(1.1, Number(value.burger.scale) || 0)) } : { remaining: 100, won: false, scale: 0.9 },
      timer: value.timer && Number.isFinite(value.timer.endsAt) ? { endsAt: value.timer.endsAt, label: String(value.timer.label).slice(0,100), kind: value.timer.kind === 'rest' ? 'rest' : 'work' } : null }
    publish()
  })
  ipcMain.handle('widget:get', event => { if (!fromWidget(event)) throw new Error('Untrusted sender'); return { ...state, onDesktop: isOnDesktop(widget) } })
  ipcMain.handle('widget:action', (event, action) => {
    if (!fromWidget(event)) throw new Error('Untrusted sender')
    if (action === 'hide') { prefs.visible = false; remember(); widget.hide(); if (!mainWindow.isVisible()) presentMain(); return }
    if (!['open','warmup','skip-rest','toggle-buddy'].includes(action)) throw new Error('Unknown widget action')
    if (action === 'open') presentMain()
    mainWindow.webContents.send('desktop:widget-action', action)
  })
  return {
    isVisible: () => !!widget && !widget.isDestroyed() && widget.isVisible(),
    restore: async () => { try { prefs = { ...prefs, ...JSON.parse(await fs.readFile(prefsFile, 'utf8')) } } catch {}; delete prefs.pinned; if (prefs.visible) await show() },
    flush: async () => { await writes },
    dispose: () => { clearTimeout(moveTimer); if (widget && !widget.isDestroyed()) widget.destroy(); tray?.destroy(); tray = null },
  }
}
module.exports = { createWidget }
