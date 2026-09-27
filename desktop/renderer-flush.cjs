const { randomUUID } = require('node:crypto')

// Disk flush cannot see mutations still waiting behind a renderer save Promise.
function createRendererFlush(ipcMain, getWindow, timeoutMs = 15000) {
  const pending = new Map()
  ipcMain.on('desktop:flush-result', (event, id, error) => {
    const wc = getWindow()?.webContents
    if (!wc || event.sender !== wc || event.senderFrame !== wc.mainFrame) return
    const request = pending.get(id)
    if (!request) return
    pending.delete(id); clearTimeout(request.timer)
    if (error) request.reject(new Error(String(error).slice(0, 500)))
    else request.resolve()
  })
  return () => new Promise((resolve, reject) => {
    const window = getWindow(), id = randomUUID()
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return reject(new Error('Окно приложения недоступно. Не удалось проверить сохранение.'))
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Приложение не подтвердило сохранение. Вернись в окно и повтори действие.'))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    try { window.webContents.send('desktop:flush-request', id) }
    catch (error) { pending.delete(id); clearTimeout(timer); reject(error) }
  })
}
module.exports = { createRendererFlush }
