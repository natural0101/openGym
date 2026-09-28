const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const mainSource = fs.readFileSync(path.join(root, 'desktop/voice.cjs'), 'utf8')
const clientSource = fs.readFileSync(path.join(root, 'frontend/src/desktop/voice-client.js'), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/export /g, '')
const tick = () => new Promise(setImmediate)
function mainHarness() {
  const handlers = {}, events = [], reads = [], sockets = []
  class Socket {
    constructor() { sockets.push(this) }
    on() {}
    removeAllListeners() {}
    terminate() { this.terminated = true }
  }
  const win = { isDestroyed: () => false, webContents: { send: (_channel, event) => events.push(event), mainFrame: { url: 'opengym://app/index.html' } } }
  const context = {
    module: { exports: {} },
    require: name => name === 'node:fs/promises' ? { readFile: () => new Promise((resolve, reject) => reads.push({ resolve, reject })) }
      : name === 'ws' ? Socket : name === './voice-config.cjs' ? { settings: () => ({}) } : require(name),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  }
  vm.runInNewContext(mainSource, context)
  const voice = context.module.exports.createVoice({ ipcMain: { handle: (name, fn) => { handlers[name] = fn } }, mainWindow: win, dataDir: 'unused', safeStorage: { decryptString: () => 'fake-never-sent' } })
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame }
  return { voice, events, reads, sockets, call: (name, ...args) => handlers['voice:' + name](event, ...args) }
}
function clientHarness(effect = 'rest', options = {}) {
  let state, listener, releaseSave
  const stops = [], rests = [], results = [], mutations = []
  const create = fn => {
    state = fn(); function store() {}
    store.getState = () => state
    store.setState = patch => Object.assign(state, typeof patch === 'function' ? patch(state) : patch)
    return store
  }
  const api = {
    voiceInfo: async () => ({ hasKey: options.hasKey !== false }), onVoice: fn => { listener = fn; return () => {} },
    voiceResult: async (...args) => { results.push(args); return options.result ? options.result() : true },
    voiceStop: async id => {
      stops.push(id)
      if (options.emitStop) listener({ type: 'status', status: 'off', sessionId: id ?? state.sessionId })
      if (options.stop) await options.stop()
      return true
    }, voiceRestComplete: async () => true,
    voiceStart: options.start || (async () => ({ sessionId: 'new' })),
  }
  const useStore = { getState: () => ({ S: {}, update: fn => {
    if (!options.deferMutation) fn({})
    return new Promise((resolve, reject) => { releaseSave = () => {
      try { if (options.deferMutation) fn({}); resolve() } catch (error) { reject(error) }
    } })
  } }) }
  const useUI = { subscribe: () => () => {}, getState: () => ({ startRest: seconds => rests.push(seconds), stopRest() {} }) }
  class AudioContext {
    constructor() { this.sampleRate = 24000; this.audioWorklet = { addModule: async () => {} } }
    async resume() {}
    async close() {}
  }
  const mod = new Function('create', 'desktop', 'useStore', 'useUI', 'applyVoiceAction', 'readVoiceAction', 'AudioContext', 'window', clientSource + '; return {bindVoice,useVoice,stopVoice,startVoice};')(
    create, () => api, useStore, useUI, () => { mutations.push(true); return { ok: true, saved: true, effect, seconds: 120 } }, () => null, AudioContext, { location: { href: 'opengym://app/index.html' } },
  )
  mod.bindVoice(); mod.useVoice.setState({ status: 'listening', sessionId: 'old' })
  return { mod, emit: e => listener(e), release: () => releaseSave(), stops, rests, results, mutations }
}
const command = (id = 'call') => ({ type: 'command', sessionId: 'old', id, arguments: '{}' })

test('stop during key read invalidates pending start without creating a socket', async () => {
  const h = mainHarness(), opening = h.call('start', 24000)
  const rejection = assert.rejects(opening, /отменено/)
  h.call('stop'); h.reads[0].resolve(Buffer.from('fake')); await rejection
  assert.equal(h.sockets.length, 0); assert.equal(h.voice.active(), false); assert.equal(h.voice.status(), 'off')
})
test('concurrent starts are locked before the key await', async () => {
  const h = mainHarness(), opening = h.call('start', 24000)
  await assert.rejects(h.call('start', 24000), /уже запущен/)
  assert.equal(h.reads.length, 1); h.reads[0].resolve(Buffer.from('fake')); await opening
  assert.equal(h.sockets.length, 1)
})
test('old key completion and scoped cleanup cannot stop a newer session', async () => {
  const h = mainHarness(), first = h.call('start', 24000), oldId = h.events[0].sessionId
  const rejected = assert.rejects(first, /отменено/)
  h.call('stop', oldId); const second = h.call('start', 24000)
  h.reads[1].resolve(Buffer.from('fake')); const session = await second
  h.reads[0].resolve(Buffer.from('fake')); await rejected
  assert.equal(h.call('stop', oldId), false); assert.equal(h.voice.active(), true); assert.equal(h.sockets.length, 1)
  assert.equal(h.call('stop', session.sessionId), true); assert.equal(h.voice.active(), false)
})
test('failed key read releases the start lock', async () => {
  const h = mainHarness(), first = h.call('start', 24000), rejected = assert.rejects(first, /ключ/)
  h.reads[0].reject(Error('missing')); await rejected
  const second = h.call('start', 24000); h.reads[1].resolve(Buffer.from('fake')); await second
  assert.equal(h.sockets.length, 1)
})
test('cancel during durable save does not start rest or acknowledge obsolete command', async () => {
  const h = clientHarness(); h.emit(command()); await tick()
  h.emit({ type: 'cancel', sessionId: 'old', id: 'call' }); h.release(); await tick()
  assert.deepEqual(h.rests, []); assert.deepEqual(h.results, [])
})
test('old stop command finishing storage cannot stop a newer conversation', async () => {
  const h = clientHarness('stop_listening'); h.emit(command()); await tick(); await h.mod.stopVoice()
  h.mod.useVoice.setState({ status: 'listening', sessionId: 'new' }); h.release(); await tick()
  assert.equal(h.mod.useVoice.getState().status, 'listening'); assert.equal(h.stops.length, 1); assert.deepEqual(h.results, [])
})
test('session is checked again after awaiting delivery of a stop result', async () => {
  let deliver
  const h = clientHarness('stop_listening', { result: () => new Promise(resolve => { deliver = resolve }) })
  h.emit(command()); await tick(); h.release(); await tick()
  await h.mod.stopVoice(); h.mod.useVoice.setState({ status: 'listening', sessionId: 'new' })
  deliver(true); await tick()
  assert.equal(h.mod.useVoice.getState().status, 'listening'); assert.equal(h.stops.length, 1)
})
test('stale start cleanup sends its own session ID and preserves a new start busy state', async () => {
  let open
  const h = clientHarness('rest', { start: () => new Promise(resolve => { open = resolve }) })
  h.mod.useVoice.setState({ status: 'off', busy: false })
  const opening = h.mod.startVoice(); await tick(); await h.mod.stopVoice()
  h.mod.useVoice.setState({ status: 'connecting', sessionId: 'new', busy: true })
  open({ sessionId: 'old-pending' }); await opening
  assert.deepEqual(h.stops, [undefined, 'old-pending']); assert.equal(h.mod.useVoice.getState().busy, true)
})
test('matching stop command still stops its own session after successful storage', async () => {
  const h = clientHarness('stop_listening'); h.emit(command()); await tick(); h.release(); await tick()
  assert.deepEqual(h.stops, ['old']); assert.equal(h.mod.useVoice.getState().status, 'off')
})
test('normal successful set starts rest exactly once', async () => {
  const h = clientHarness('rest'); h.emit(command()); await tick(); h.release(); await tick()
  assert.deepEqual(h.rests, [120]); assert.equal(h.results.length, 1)
})
test('command cancelled while waiting for an earlier save never mutates its draft', async () => {
  const h = clientHarness('rest', { deferMutation: true }); h.emit(command()); await tick()
  h.emit({ type: 'cancel', sessionId: 'old', id: 'call' }); h.release(); await tick()
  assert.deepEqual(h.mutations, []); assert.deepEqual(h.rests, []); assert.deepEqual(h.results, [])
})
test('queued mutation from an ended session never changes the new session data', async () => {
  const h = clientHarness('rest', { deferMutation: true }); h.emit(command()); await tick()
  await h.mod.stopVoice(); h.mod.useVoice.setState({ status: 'listening', sessionId: 'new' }); h.release(); await tick()
  assert.deepEqual(h.mutations, []); assert.deepEqual(h.rests, []); assert.deepEqual(h.results, [])
})
test('no-key error stays visible after the backend acknowledges cleanup with off', async () => {
  const h = clientHarness('rest', { hasKey: false, emitStop: true })
  h.mod.useVoice.setState({ status: 'off', sessionId: null })
  await h.mod.startVoice()
  assert.equal(h.mod.useVoice.getState().status, 'error')
  assert.equal(h.mod.useVoice.getState().error, 'Для первого разговора подключи Deepgram.')
  assert.equal(h.mod.useVoice.getState().busy, false)
})
test('an older cleanup error cannot overwrite a new local start', async () => {
  const cleanups = []
  const h = clientHarness('rest', { hasKey: false, emitStop: true, stop: () => new Promise(resolve => { cleanups.push(resolve) }) })
  h.mod.useVoice.setState({ status: 'off', sessionId: null })
  const opening = h.mod.startVoice(); await tick()
  // Explicit stop invalidates the old cleanup; a subsequent conversation now owns UI state.
  const stopping = h.mod.stopVoice(); await tick()
  h.mod.useVoice.setState({ status: 'connecting', sessionId: 'new', busy: true })
  cleanups[1](); await stopping
  cleanups[0](); await opening
  assert.equal(h.mod.useVoice.getState().status, 'connecting')
})
test('late connecting or listening events cannot revive a stopped conversation', async () => {
  const h = clientHarness(); await h.mod.stopVoice()
  h.emit({ type: 'status', status: 'connecting', sessionId: 'late' })
  h.emit({ type: 'status', status: 'listening', sessionId: 'old' })
  assert.equal(h.mod.useVoice.getState().status, 'off'); assert.equal(h.mod.useVoice.getState().sessionId, 'old')
})
test('late connecting events cannot replace an already live conversation', () => {
  const h = clientHarness()
  h.emit({ type: 'status', status: 'connecting', sessionId: 'stale' })
  assert.equal(h.mod.useVoice.getState().status, 'listening'); assert.equal(h.mod.useVoice.getState().sessionId, 'old')
})
