const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const WebSocket = require('ws')
const { settings } = require('./voice-config.cjs')

function createVoice({ ipcMain, mainWindow, dataDir, safeStorage, endpoint = 'wss://agent.deepgram.com/v1/agent/converse', onStatus = () => {} }) {
  const keyFile = path.join(dataDir, 'voice-key.bin')
  let socket = null, sessionId = null, ready = false, interval, deadline, current = 'off'
  const pending = new Map(), finished = new Map()
  // Conversation context stays in memory across disconnects, never in logs or backups.
  const history = []
  const remember = item => {
    history.push(item)
    while (history.length > 60 || JSON.stringify(history).length > 50000) history.shift()
  }
  const emit = payload => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('voice:event', { ...payload, sessionId }) }
  const state = (status, message = '') => { current = status; emit({ type: 'status', status, message }); onStatus(status) }
  const send = message => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) }
  const stop = (message = '', failed = false) => {
    const old = socket; socket = null; ready = false
    clearInterval(interval); clearTimeout(deadline)
    for (const item of pending.values()) clearTimeout(item.timer)
    pending.clear(); finished.clear()
    if (old) { old.removeAllListeners(); old.on('error', () => {}); old.terminate() }
    state(failed ? 'error' : 'off', message)
  }
  const handle = (name, fn) => ipcMain.handle(name, (event, ...args) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !event.senderFrame.url.startsWith('opengym://app/')) throw Error('Untrusted voice sender')
    return fn(...args)
  })
  handle('voice:info', async () => ({ hasKey: await fs.access(keyFile).then(() => true, () => false), status: current }))
  handle('voice:key', async value => {
    if (socket) throw Error('Сначала выключи микрофон.')
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{20,256}$/.test(value.trim())) throw Error('Вставь действительный API-ключ Deepgram.')
    if (!safeStorage.isEncryptionAvailable()) throw Error('Windows не предоставила защищённое хранилище ключа.')
    const bytes = safeStorage.encryptString(value.trim())
    await fs.writeFile(keyFile + '.tmp', bytes, { mode: 0o600 }); await fs.rename(keyFile + '.tmp', keyFile)
    return { hasKey: true }
  })
  handle('voice:forget', async () => { stop(); history.length = 0; await fs.rm(keyFile, { force: true }); return { hasKey: false } })
  handle('voice:start', async sampleRate => {
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw Error('Неподдерживаемая частота микрофона.')
    if (socket) throw Error('Голосовой разговор уже запущен.')
    let key
    try { key = safeStorage.decryptString(await fs.readFile(keyFile)) } catch { throw Error('Добавь ключ Deepgram в разделе «Голосовой напарник».') }
    sessionId = randomUUID(); state('connecting')
    const ws = socket = new WebSocket(endpoint, { headers: { Authorization: `Token ${key}` }, handshakeTimeout: 15000, maxPayload: 1024 * 1024 })
    key = null
    deadline = setTimeout(() => stop('Deepgram не подтвердил настройки. Проверь ключ, баланс и доступ к Voice Agent.', true), 20000)
    ws.on('open', () => { if (socket === ws) send(settings(sampleRate, [...history])) })
    ws.on('unexpected-response', (_request, response) => { response.resume(); if (socket === ws) stop(response.statusCode === 401 || response.statusCode === 403 ? 'Deepgram отклонил ключ или доступ к Voice Agent.' : `Deepgram недоступен (HTTP ${response.statusCode}). Попробуй подключиться ещё раз.`, true) })
    ws.on('error', () => { if (socket === ws) stop('Нет соединения с Deepgram. Проверь интернет и повтори подключение.', true) })
    ws.on('close', () => { if (socket === ws) stop('Разговор отключён. Подходы сохранены; для продолжения включи микрофон.', true) })
    ws.on('message', (bytes, binary) => {
      if (socket !== ws) return
      if (binary) { if (ready) emit({ type: 'audio', bytes: new Uint8Array(bytes) }); return }
      let event; try { event = JSON.parse(bytes.toString()) } catch { return }
      if (event.type === 'SettingsApplied') { clearTimeout(deadline); ready = true; state('listening'); interval = setInterval(() => send({ type: 'KeepAlive' }), 5000) }
      if (event.type === 'UserStartedSpeaking') { emit({ type: 'interrupt' }); state('listening') }
      if (event.type === 'AgentThinking') state('thinking')
      if (event.type === 'ConversationText' && ['user', 'assistant'].includes(event.role)) {
        const text = String(event.content || '').slice(0, 6000)
        remember({ type: 'History', role: event.role, content: text })
        emit({ type: 'transcript', role: event.role, text })
      }
      if (event.type === 'AgentStartedSpeaking') state('speaking')
      if (event.type === 'AgentAudioDone') emit({ type: 'audio-done' })
      if (event.type === 'Error') stop(`Deepgram: ${String(event.code || 'ошибка сервиса').slice(0, 90)}. ${String(event.description || '').replace(/[a-z0-9]{32,}/gi, '[скрыто]').slice(0, 400)}`, true)
      if (event.type === 'Warning') emit({ type: 'notice', text: 'Deepgram сообщил о задержке или ошибке модели. Если ответа нет, переподключи микрофон.' })
      if (event.type === 'FunctionCallCancelled') {
        const item = pending.get(event.id); if (item) { clearTimeout(item.timer); pending.delete(event.id); emit({ type: 'cancel', id: event.id }) }
      }
      if (event.type === 'FunctionCallRequest') for (const fn of (event.functions || []).slice(0, 20)) {
        if (!fn.client_side || typeof fn.id !== 'string') continue
        if (finished.has(fn.id)) { send(finished.get(fn.id)); continue }
        if (pending.has(fn.id)) continue
        if (fn.name !== 'workout_action' || typeof fn.arguments !== 'string' || fn.arguments.length > 8000) { send({ type: 'FunctionCallResponse', id: fn.id, name: fn.name, content: JSON.stringify({ ok: false, error: 'Недопустимая команда.' }) }); continue }
        const timer = setTimeout(() => { if (pending.has(fn.id)) stop('Не получено подтверждение записи. Проверь журнал перед повтором команды.', true) }, 20000)
        pending.set(fn.id, { timer, signature: fn.thought_signature, arguments: fn.arguments })
        emit({ type: 'command', id: fn.id, arguments: fn.arguments })
      }
    })
    return { sessionId }
  })
  handle('voice:stop', () => { stop(); return true })
  handle('voice:audio', (id, bytes) => {
    if (id !== sessionId || !ready || !socket || !(bytes instanceof Uint8Array) || bytes.byteLength > 32768 || bytes.byteLength % 2) return false
    if (socket.bufferedAmount > 256000) { stop('Соединение не успевает передавать звук. Подключись ещё раз.', true); return false }
    socket.send(bytes); return true
  })
  handle('voice:result', (id, callId, result) => {
    if (id !== sessionId || !pending.has(callId)) return false
    const text = JSON.stringify(result); if (text.length > 60000) throw Error('Ответ слишком большой.')
    const item = pending.get(callId); clearTimeout(item.timer); pending.delete(callId)
    const response = { type: 'FunctionCallResponse', id: callId, name: 'workout_action', content: text, ...(item.signature ? { thought_signature: item.signature } : {}) }
    remember({ type: 'History', function_calls: [{ id: callId, name: 'workout_action', client_side: true, arguments: item.arguments, response: text }] })
    finished.set(callId, response); if (finished.size > 500) finished.delete(finished.keys().next().value)
    send(response); return true
  })
  return { stop, active: () => !!socket, status: () => current }
}
module.exports = { createVoice }
