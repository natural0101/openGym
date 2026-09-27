import { create } from 'zustand'
import { desktop } from './platform.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { applyVoiceAction, readVoiceAction } from './voice-actions.js'

export const VOICE_LABELS = { off: 'Микрофон выключен', connecting: 'Подключаюсь…', listening: 'Слушаю тебя', thinking: 'Обдумываю ответ', speaking: 'Напарник отвечает', error: 'Разговор прерван' }
export const useVoice = create(() => ({ status: 'off', error: '', hasKey: false, messages: [], sessionId: null, busy: false }))
let context, stream, source, capture, gain, nextAudio = 0, generation = 0, queue = Promise.resolve(), bound = false, stopOnFinish = false
const playing = new Set(), cancelled = new Set()
const message = (role, text) => useVoice.setState(s => ({ messages: [...s.messages, { role, text, id: crypto.randomUUID() }].slice(-80) }))
function silence() { for (const node of playing) { try { node.stop() } catch {} } playing.clear(); nextAudio = 0 }
function release() {
  generation++; silence()
  if (stream) { for (const track of stream.getTracks()) { track.onended = null; track.stop() } stream = null }
  if (capture) { capture.port.onmessage = null; capture.disconnect(); capture = null }
  source?.disconnect(); gain?.disconnect(); source = null; gain = null
  if (context) { void context.close().catch(() => {}); context = null }
}
export async function refreshVoice() { const info = await desktop().voiceInfo(); useVoice.setState({ hasKey: info.hasKey }); return info }
export async function stopVoice() { release(); useVoice.setState({ status: 'off', busy: false }); await desktop().voiceStop() }
async function failVoice(error) {
  await stopVoice().catch(() => {})
  useVoice.setState({ error, status: 'error' })
}
export async function startVoice() {
  if (useVoice.getState().busy || !['off', 'error'].includes(useVoice.getState().status)) return
  useVoice.setState({ busy: true, error: '', status: 'connecting' })
  const token = ++generation
  try {
    if (!(await refreshVoice()).hasKey) throw Error('Сначала добавь ключ Deepgram ниже.')
    if (token !== generation) return
    context = new AudioContext({ sampleRate: 24000 }); await context.resume()
    await context.audioWorklet.addModule(new URL('../../voice-capture.js', window.location.href).href)
    if (token !== generation) return
    const session = await desktop().voiceStart(context.sampleRate)
    if (token !== generation) { await desktop().voiceStop(); return }
    useVoice.setState({ sessionId: session.sessionId })
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false })
    if (token !== generation) { acquired.getTracks().forEach(t => t.stop()); return }
    stream = acquired
    stream.getAudioTracks().forEach(track => { track.onended = () => { void failVoice('Микрофон отключён. Подключи его и начни разговор снова.') } })
    source = context.createMediaStreamSource(stream); capture = new AudioWorkletNode(context, 'gym-voice-capture'); gain = context.createGain(); gain.gain.value = 0
    source.connect(capture); capture.connect(gain); gain.connect(context.destination)
    capture.port.onmessage = event => { if (token === generation) desktop().voiceAudio(session.sessionId, new Uint8Array(event.data)).catch(() => { if (token === generation) void failVoice('Не удалось передать звук. Включи микрофон повторно; беседа сохранена до выхода из приложения.') }) }
  } catch (error) {
    if (token !== generation) return
    release(); await desktop().voiceStop().catch(() => {})
    useVoice.setState({ status: 'error', error: error.name === 'NotAllowedError' ? 'Нет доступа к микрофону. Разреши его для классических приложений в настройках конфиденциальности Windows.' : error.name === 'NotFoundError' ? 'Микрофон не найден. Подключи его и повтори.' : error.message })
  } finally { useVoice.setState({ busy: false }) }
}
export function bindVoice() {
  if (bound) return () => {}
  bound = true
  const unsubscribeRest = useUI.subscribe((state, previous) => {
    const cue = state.restCompleted, voice = useVoice.getState()
    if (cue && cue !== previous.restCompleted && !['off', 'error', 'connecting'].includes(voice.status)) {
      message('notice', 'Отдых окончен. Продолжай, когда восстановишься.')
      void desktop().voiceRestComplete(voice.sessionId, cue.id).catch(() => message('notice', 'Голосовое напоминание не отправлено; таймер завершён.'))
    }
  })
  const unsubscribe = desktop().onVoice(event => {
    if (event.type === 'status') {
      if (event.status === 'connecting') useVoice.setState({ sessionId: event.sessionId })
      if (event.sessionId !== useVoice.getState().sessionId && event.sessionId != null) return
      useVoice.setState({ status: event.status, ...(event.message ? { error: event.message } : {}) })
      if (['off', 'error'].includes(event.status)) release()
      return
    }
    if (event.sessionId !== useVoice.getState().sessionId) return
    if (event.type === 'transcript') message(event.role, event.text)
    if (event.type === 'notice') message('notice', event.text)
    if (event.type === 'cancel') cancelled.add(event.id)
    if (event.type === 'interrupt') silence()
    if (event.type === 'audio' && context) {
      const bytes = new Uint8Array(event.bytes)
      if (bytes.length % 2) return
      const pcm = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const buffer = context.createBuffer(1, bytes.length / 2, 24000), channel = buffer.getChannelData(0)
      for (let i = 0; i < channel.length; i++) channel[i] = pcm.getInt16(i * 2, true) / 32768
      if (nextAudio - context.currentTime > 30) { silence(); message('notice', 'Ответ слишком длинный. Звуковая очередь очищена.'); return }
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination)
      playing.add(node); node.onended = () => { playing.delete(node); if (!playing.size && useVoice.getState().status === 'speaking') useVoice.setState({ status: 'listening' }) }
      nextAudio = Math.max(context.currentTime + .015, nextAudio); node.start(nextAudio); nextAudio += buffer.duration
    }
    if (event.type === 'audio-done' && !playing.size && useVoice.getState().status === 'speaking') useVoice.setState({ status: 'listening' })
    if (event.type === 'command') {
      queue = queue.catch(() => {}).then(async () => {
        if (cancelled.delete(event.id) || event.sessionId !== useVoice.getState().sessionId || ['off', 'error'].includes(useVoice.getState().status)) return
        let result
        try {
          const args = JSON.parse(event.arguments)
          result = readVoiceAction(useStore.getState().S, args)
          if (!result) {
            await useStore.getState().update(S => { result = applyVoiceAction(S, args, event.id) })
            if (!result.duplicate) {
              if (result.effect === 'rest') useUI.getState().startRest(result.seconds, result.entry_index)
              if (result.effect === 'stop_rest') useUI.getState().stopRest()
              if (result.effect === 'stop_listening') stopOnFinish = true
              message('saved', result.message || (result.effect === 'rest' ? `Отдых: ${result.seconds} сек.` : result.effect === 'stop_rest' ? 'Отдых остановлен.' : 'Микрофон выключен.'))
            }
          }
        } catch (error) { result = { ok: false, saved: false, error: error.message }; message('notice', error.message) }
        await desktop().voiceResult(event.sessionId, event.id, result)
        if (stopOnFinish) { stopOnFinish = false; await stopVoice() }
      })
    }
  })
  void refreshVoice().catch(() => {})
  return () => { unsubscribeRest(); unsubscribe(); bound = false; void stopVoice() }
}
