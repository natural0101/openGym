import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { desktop } from './platform.js'
import { useStore } from '../store/useStore.js'
import { useVoice, VOICE_LABELS, startVoice, stopVoice, refreshVoice } from './voice-client.js'
import './voice.css'

export default function DesktopVoice() {
  const voice = useVoice(), active = useStore(s => s.S.active), nav = useNavigate()
  const [key, setKey] = useState(''), [saving, setSaving] = useState(false), [keyMessage, setKeyMessage] = useState(''), [keyError, setKeyError] = useState('')
  const transcript = useRef(null)
  const on = !['off', 'error'].includes(voice.status)
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'instant' }) }, [voice.messages.length])
  const saveKey = async event => {
    event.preventDefault(); setSaving(true); setKeyError(''); setKeyMessage('')
    try { await desktop().voiceKey(key); setKey(''); await refreshVoice(); setKeyMessage('Ключ сохранён на этом компьютере. Теперь включи микрофон.') }
    catch (error) { setKeyError(error.message) } finally { setSaving(false) }
  }
  return <div className="desk-voice">
    <div className="desk-page-heading"><div><h1>Голосовой напарник</h1><p>Ты тренируешься. Напарник слушает и ведёт журнал.</p></div><span className="desk-badge">Deepgram · русский</span></div>
    <div className="voice-layout"><section className="desk-panel voice-conversation">
      <div className="voice-session"><div><span className={'voice-indicator ' + (on ? 'on' : '')} /><b role="status">{VOICE_LABELS[voice.status]}</b><p>{on ? 'Микрофон передаёт звук. Можно свернуть окно и продолжить с виджетом.' : 'Микрофон включается только по твоей кнопке.'}</p></div>
        <button className={'btn ' + (on ? '' : 'primary')} disabled={saving || (!on && voice.busy)} onClick={() => { void (on ? stopVoice() : startVoice()) }}>{on ? 'Выключить микрофон' : 'Начать разговор'}</button>
      </div>
      {voice.error && <div className="voice-error" role="alert">{voice.error}</div>}
      <div className="voice-transcript" ref={transcript} role="log" aria-label="Разговор с напарником" aria-live="polite">
        {!voice.messages.length ? <div className="voice-empty"><img src="./mascots/cake.png" alt="Тортик — твой напарник" /><h2>Расскажи, что сделал</h2><p>Например: «Сгибания с гантелями по пять килограммов, десять повторов».</p><small>Это пример фразы, не запись тренировки.</small></div> : voice.messages.map(m => <div className={'voice-message ' + m.role} key={m.id}><b>{m.role === 'user' ? 'Ты' : m.role === 'assistant' ? 'Напарник' : m.role === 'saved' ? 'Подтверждено приложением' : 'Обрати внимание'}</b><p>{m.text}</p></div>)}
      </div>
      <div className="voice-session-foot"><span>{active ? `${active.name} · ${active.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)} подходов` : 'Активной тренировки пока нет'}</span><button className="btn sm" onClick={() => nav(active ? '/workout' : '/history')}>{active ? 'К тренировке' : 'Открыть журнал'}</button></div>
    </section><aside className="voice-sidebar">
      <section className="desk-panel"><h2>Один ключ — весь разговор</h2><p className="desk-helper">Deepgram распознаёт речь, ведёт разговор и озвучивает ответы. Нужен доступ к Voice Agent API и баланс на аккаунте.</p>
        <form onSubmit={saveKey}><label className="desk-field">API-ключ Deepgram<input type="password" className="input" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder={voice.hasKey ? 'Ключ уже сохранён' : 'Вставь ключ сюда'} disabled={on || saving} maxLength={256} /></label><button className="btn" disabled={on || saving || !key.trim()}>{saving ? 'Сохраняю…' : voice.hasKey ? 'Заменить ключ' : 'Сохранить ключ'}</button></form>
        {keyMessage && <p className="voice-key-status" role="status">{keyMessage}</p>}{keyError && <p className="voice-error" role="alert">{keyError}</p>}
        {voice.hasKey && <button className="voice-remove" disabled={on || saving} onClick={async () => { setSaving(true); try { await desktop().voiceForget(); await refreshVoice(); setKeyMessage('Ключ удалён.'); setKeyError('') } catch (e) { setKeyError(e.message) } finally { setSaving(false) } }}>Удалить сохранённый ключ</button>}
        <p className="voice-privacy">Ключ зашифрован средствами Windows и не входит в копию тренировок. Пока микрофон включён, звук и контекст занятия передаются Deepgram и его поставщикам моделей. Время подключения, включая паузы, оплачивается по тарифу Deepgram.</p>
      </section>
      <section className="desk-panel voice-phrases"><h2>Говори обычными словами</h2><p>«Ещё один подход: восемь кило, десять раз»</p><p>«Исправь последний: было двенадцать повторов»</p><p>«Отмени последний подход»</p><p>«Поставь отдых на минуту»</p><p>«На дорожке десять минут, скорость четыре»</p><p>«Закончил тренировку»</p><small>Неясный вес или упражнение напарник уточнит. Запись появится в журнале после завершения занятия; подходы сохраняются сразу.</small></section>
      <button className="btn" onClick={() => desktop().showWidget()}>Показать виджет на рабочем столе</button>
    </aside></div>
  </div>
}
