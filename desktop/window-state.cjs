const fs = require('node:fs/promises')
const path = require('node:path')

async function createWindowState(dataDir, screen) {
  const file = path.join(dataDir, 'window-state.json')
  let saved
  try { saved = JSON.parse(await fs.readFile(file, 'utf8')) } catch {}
  const valid = saved && ['x', 'y', 'width', 'height'].every(k => Number.isInteger(saved[k]) && Math.abs(saved[k]) <= 100000) && saved.width >= 400 && saved.height >= 300
  const area = (valid ? screen.getDisplayMatching(saved) : screen.getPrimaryDisplay()).workArea
  const width = Math.min(area.width, valid ? Math.max(800, saved.width) : 1100)
  const height = Math.min(area.height, valid ? Math.max(600, saved.height) : 760)
  const bounds = { width, height, x: valid ? Math.max(area.x, Math.min(saved.x, area.x + area.width - width)) : area.x + Math.round((area.width-width)/2), y: valid ? Math.max(area.y, Math.min(saved.y, area.y + area.height - height)) : area.y + Math.round((area.height-height)/2) }
  let timer, win, queue = Promise.resolve()
  function flush() {
    clearTimeout(timer)
    if (!win || win.isDestroyed() || win.isMinimized()) return queue
    const value = JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })
    queue = queue.catch(() => {}).then(async () => { await fs.writeFile(file + '.tmp', value); await fs.rename(file + '.tmp', file) })
    return queue
  }
  return { bounds, maximized: valid && saved.maximized === true, flush, bind(window) {
    win = window
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void flush().catch(() => {}) }, 250) }
    for (const event of ['move', 'resize', 'maximize', 'unmaximize']) win.on(event, schedule)
    win.on('closed', () => clearTimeout(timer))
  } }
}
module.exports = { createWindowState }
