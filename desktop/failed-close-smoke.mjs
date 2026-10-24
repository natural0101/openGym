// Run sequentially with the other Electron smoke tests. Uses only an isolated
// fixture profile, a fake microphone and a loopback voice provider.
import { _electron as electron } from 'playwright'
import { WebSocket, WebSocketServer } from 'ws'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'

const output = path.resolve('desktop/test-output')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(path.join(output, 'failed-close-'))
const fakeKey = 'opengym_failed_close_fake_key_not_a_real_secret'
const failureMessage = 'TEST failed-close disk unavailable'
const report = { passed: false, profile, fixtureRetained: true }
const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
let app, socket, inputBytes = 0, connections = 0, socketClosed = false, appClosed = false
const providerErrors = []
server.on('connection', (ws, request) => {
  socket = ws
  connections++
  if (request.headers.authorization !== `Token ${fakeKey}`) providerErrors.push('Unexpected fake-provider authorization')
  ws.on('error', error => providerErrors.push(error.message))
  ws.on('close', () => { socketClosed = true })
  ws.on('message', (data, binary) => {
    if (binary) { inputBytes += data.length; return }
    try {
      const event = JSON.parse(data.toString())
      if (event.type === 'Settings') ws.send(JSON.stringify({ type: 'SettingsApplied' }))
    } catch (error) { providerErrors.push(error.message) }
  })
})
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function eventually(check, message, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await check()) return; await sleep(50) }
  throw Error(message)
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

try {
  app = await electron.launch({
    args: ['.', '--use-fake-device-for-media-stream'],
    env: { ...process.env, OPENGYM_TEST_DATA: profile, OPENGYM_VOICE_TEST_URL: `ws://127.0.0.1:${server.address().port}` },
  })
  app.on('close', () => { appClosed = true })
  const page = await app.firstWindow()
  await page.getByRole('heading', { name: 'Сегодня', exact: true }).waitFor()
  const info = await page.evaluate(() => window.openGymDesktop.info())
  assert.equal(info.packaged, false, 'Test must run the development app with fixture-profile override')
  assert.equal(path.resolve(info.dataDir), profile, 'No access to an installed application profile is permitted')
  const initial = await page.evaluate(() => window.openGymDesktop.load())
  assert.deepEqual(initial.state.workouts, [])
  assert.equal(initial.state.active, null)
  assert.equal((await page.evaluate(() => window.openGymDesktop.voiceInfo())).hasKey, false)

  await page.evaluate(() => { location.hash = '/settings' })
  const name = page.getByLabel('Как тебя называть', { exact: true })
  await name.fill('Failed-close fixture baseline')
  const trainingPath = path.join(profile, 'training.json')
  await eventually(async () => {
    try { return JSON.parse(await readFile(trainingPath, 'utf8')).desktopName === 'Failed-close fixture baseline' }
    catch { return false }
  }, 'Fixture baseline name must reach the actual training file')

  const opening = app.waitForEvent('window')
  await page.evaluate(() => window.openGymDesktop.showWidget())
  const widget = await opening
  await widget.waitForURL('**/widget/index.html')
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(win => win.webContents.getURL().includes('/widget/') && win.isVisible())), true)
  report.widgetVisibleBeforeClose = true

  await page.evaluate(key => window.openGymDesktop.voiceKey(key), fakeKey)
  await page.evaluate(() => { location.hash = '/voice' })
  await page.getByRole('button', { name: 'Начать разговор', exact: true }).click()
  await page.getByText('Слушаю тебя', { exact: true }).waitFor()
  await eventually(() => inputBytes > 0, 'Fake microphone must send actual PCM to the loopback provider')
  assert.equal(connections, 1)
  assert.equal(socket.readyState, WebSocket.OPEN)
  assert.equal((await page.evaluate(() => window.openGymDesktop.voiceInfo())).status, 'listening')
  assert.deepEqual(providerErrors, [])
  report.voiceListeningBeforeClose = true
  report.fakeMicrophoneInputBytes = inputBytes

  await page.evaluate(() => { location.hash = '/settings' })
  await name.waitFor()
  // Settle the real renderer transaction queue after widget/voice setup and
  // before taking the byte baseline or replacing the save handler. Merely
  // observing a UI value is not proof that queued persistence has finished.
  await app.evaluate(({ BrowserWindow, ipcMain }, requestId) => new Promise((resolve, reject) => {
    const main = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('opengym://app/') && !win.webContents.getURL().includes('/widget/'))
    if (!main) { reject(Error('Main window not found for pre-failure flush')); return }
    let timer
    const finish = error => {
      clearTimeout(timer)
      ipcMain.removeListener('desktop:flush-result', onResult)
      if (error) reject(Error(String(error))); else resolve()
    }
    const onResult = (event, id, error) => {
      if (id !== requestId || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame) return
      finish(error)
    }
    ipcMain.on('desktop:flush-result', onResult)
    timer = setTimeout(() => finish('Pre-failure renderer flush timed out'), 10000)
    try { main.webContents.send('desktop:flush-request', requestId) }
    catch (error) { finish(error.message) }
  }), `failed-close-baseline-${randomUUID()}`)
  const before = await readFile(trainingPath)
  assert.equal(JSON.parse(before.toString('utf8')).desktopName, 'Failed-close fixture baseline')
  report.rendererWritesDrainedBeforeFailure = true
  report.trainingBeforeSha256 = hash(before)
  await app.evaluate(({ ipcMain, dialog }, message) => {
    // Reject at the real persistence IPC boundary. The renderer's existing
    // failed-save state must make its real flush acknowledgement fail too.
    ipcMain.removeHandler('desktop:save')
    ipcMain.handle('desktop:save', () => { throw Error(message) })
    globalThis.failedCloseDialog = null
    globalThis.confirmFailedClose = null
    dialog.showMessageBox = async (_window, options) => {
      globalThis.failedCloseDialog = { title: options.title, message: options.message, buttons: options.buttons }
      return new Promise(resolve => { globalThis.confirmFailedClose = () => resolve({ response: 1, checkboxChecked: false }) })
    }
  }, failureMessage)
  await name.fill('Rejected draft must never reach training.json')
  await page.waitForFunction(message => document.querySelector('.desk-alert')?.textContent.includes(message), failureMessage)
  assert.deepEqual(await readFile(trainingPath), before, 'Rejected save must leave fixture training bytes untouched')
  await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('opengym://app/') && !win.webContents.getURL().includes('/widget/'))
    if (!main) throw Error('Main window not found')
    main.close()
  })
  await eventually(() => app.evaluate(() => globalThis.failedCloseDialog !== null), 'Failed renderer flush must open the close-without-saving dialog')
  const confirmation = await app.evaluate(() => globalThis.failedCloseDialog)
  assert.equal(confirmation.title, 'Данные не сохранены')
  assert(confirmation.message.includes(failureMessage))
  assert.equal(confirmation.buttons[1], 'Закрыть без сохранения')
  assert.equal(socketClosed, false, 'Voice should remain active while the decision is pending')
  report.realRendererFlushFailureObserved = true
  report.closeWithoutSavingConfirmed = true
  await app.evaluate(() => { setTimeout(() => globalThis.confirmFailedClose(), 0) })
  await eventually(() => appClosed && socketClosed, 'Closing after a failed flush must terminate both the app and its voice socket', 15000)
  assert.equal(appClosed, true)
  assert.equal(socketClosed, true)
  assert.deepEqual(await readFile(trainingPath), before, 'Close-without-saving must preserve prior fixture training bytes')
  report.trainingAfterSha256 = hash(await readFile(trainingPath))
  report.appClosed = true
  report.voiceSocketClosed = true
  report.trainingBytesPreserved = true
  report.passed = true
} catch (error) {
  report.error = error.message
  throw error
} finally {
  // Release a pending fake dialog on failure, then stop only this test's app
  // and loopback server. Retain the isolated fixture for inspection.
  if (app && !appClosed) {
    await app.evaluate(({ dialog }) => {
      // Teardown must also answer a fresh close dialog opened by app.quit().
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
      globalThis.confirmFailedClose?.()
    }).catch(() => {})
    await app.close().catch(() => {})
  }
  for (const client of server.clients) client.terminate()
  await new Promise(resolve => server.close(resolve))
  await writeFile(path.join(output, 'failed-close-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
}
