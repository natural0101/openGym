import { useState } from 'react'
import { desktop } from './platform.js'
import { useVoice, refreshVoice } from './voice-client.js'

export default function VoiceConnection() {
  const voice = useVoice()
  const [key, setKey] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const on = !['off', 'error'].includes(voice.status)
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try { await desktop().voiceKey(key); setKey(''); await refreshVoice(); setMessage('Ключ сохранён. Разговор включается на странице «Сегодня».') }
    catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <details className="voice-connection"><summary>{voice.hasKey ? 'Подключение настроено' : 'Подключить Deepgram'}</summary>
    <form onSubmit={save}><label className="desk-field">API-ключ Deepgram<input className="input" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} maxLength={256} disabled={on || busy} placeholder={voice.hasKey ? 'Ключ сохранён' : 'Вставь ключ'} /></label><button className="btn" disabled={on || busy || !key.trim()}>{busy ? 'Сохраняю…' : 'Сохранить ключ'}</button></form>
    {voice.hasKey && <button className="btn sm" disabled={on || busy} onClick={async()=>{setBusy(true);try{await desktop().voiceForget();await refreshVoice();setMessage('Ключ удалён.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}}>Удалить ключ</button>}
    {message && <p role="status">{message}</p>}
    <small>Ключ зашифрован на компьютере. При включённом микрофоне звук и контекст тренировки передаются Deepgram; подключение оплачивается по его тарифу.</small>
  </details>
}
