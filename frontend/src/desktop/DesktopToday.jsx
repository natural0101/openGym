import VoiceConnection from './VoiceConnection.jsx'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO, isoOf } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'
import { exerciseLabel } from './exercise-labels.js'
import { useVoice, startVoice, stopVoice, VOICE_LABELS } from './voice-client.js'
import { applyVoiceAction } from './voice-actions.js'
import MotivationPanel from './MotivationPanel.jsx'
import './DesktopToday.css'

const time = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
function SetRow({ row, index, unit, approximate }) {
  const cardio = row.mode === 'cardio' || row.min != null
  return <li className="today-set"><span>{index + 1}</span><b>{cardio ? `${row.min ?? 0} мин` : row.sec != null ? `${row.sec} сек` : `${row.w ?? 0} ${unit === 'lb' ? 'фунт.' : 'кг'}`}</b><span>{cardio ? row.speed != null ? `${row.speed} км/ч` : 'Кардио' : row.sec != null ? 'На время' : `${approximate || row.approximate ? '≈' : ''}${row.r ?? 0} повторов`}</span></li>
}

function ExerciseCard({ entry, state, onEdit, editable }) {
  const rows = entry.sets.filter(s => s.done)
  const name = exerciseLabel(state, exOr(entry.id))
  const approximate = /приблизительн|в среднем|примерно/i.test(entry.note || '')
  const unit = state.unit === 'lb' ? 'фунт.' : 'кг'
  const groups = []
  for (const row of rows) {
    const cardio = row.mode === 'cardio' || row.min != null
    const value = cardio ? `${row.min ?? 0} мин${row.speed != null ? ` · ${row.speed} км/ч` : ''}` : row.sec != null ? `${row.sec} сек` : `${row.w ?? 0} ${unit} · ${approximate || row.approximate ? '≈' : ''}${row.r ?? 0} повторов`
    const last = groups.at(-1)
    if (last?.value === value) last.count++
    else groups.push({ value, count: 1 })
  }
  const countLabel = n => n % 10 === 1 && n % 100 !== 11 ? 'подход' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'подхода' : 'подходов'
  return <article className="today-exercise"><details>
    <summary className="today-exercise-summary"><div><h3>{name}</h3><p>{groups.length === 1 ? `${groups[0].value} · ${rows.length} ${countLabel(rows.length)}` : `${rows.length} ${countLabel(rows.length)} · разные значения`}</p></div><span className="today-expand" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span></summary>
    <div className="today-exercise-detail">
      {groups.length > 1 && <div className="today-groups">{groups.map((g, i) => <span key={i}>{g.count} × {g.value}</span>)}</div>}
      <div className="today-set-heading"><span>Подход</span><span>Вес / время</span><span>Повторы / скорость</span></div>
      <ol>{rows.map((row, j) => <SetRow key={row.voiceId || j} row={row} index={j} unit={state.unit} approximate={approximate} />)}</ol>
      {entry.note && <p className="today-entry-note">{entry.note}</p>}
      <div className="today-detail-footer"><span>Выполнено: {rows.length} {countLabel(rows.length)}</span><button className="btn sm" onClick={onEdit}>{editable ? 'Изменить / добавить подход' : 'Открыть в истории'}</button></div>
    </div>
  </details></article>
}

export default function DesktopToday() {
  const S = useStore(s => s.S), nav = useNavigate(), timer = useUI(s => s.timer)
  const voice = useVoice(), [day, setDay] = useState(todayISO()), [finishing, setFinishing] = useState(false)
  const today = todayISO(), isToday = day === today
  const sessions = [...S.workouts.filter(w => w.d === day), ...(S.active?.d === day ? [S.active] : [])]
  const completed = sessions.flatMap(w => w.entries.flatMap(e => e.sets.filter(s => s.done)))
  const listening = !['off', 'error'].includes(voice.status)
  const move = delta => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + delta); setDay(isoOf(d)) }
  const messages = voice.messages.slice(-3)
  const canFinish = isToday && S.active?.d === today && !S.active.backfill && S.active.entries.some(e => e.sets.some(s => s.done))
  const finish = async () => {
    if (!canFinish || finishing) return
    setFinishing(true)
    try {
      await useStore.getState().update(draft => { applyVoiceAction(draft, { action: 'finish' }, crypto.randomUUID()) })
      useUI.getState().stopRest()
      useUI.getState().toast('Тренировка сохранена. Все подходы остаются здесь.')
    } catch (error) { useUI.getState().toast('Не удалось завершить тренировку: ' + error.message) }
    finally { setFinishing(false) }
  }
  return <div className="workspace-home today-page">
    <div className="workspace-heading"><div><h1>{isToday ? 'Сегодня' : 'Моя тренировка'}</h1></div></div>
    <div className="today-date"><button className="btn" aria-label="Предыдущий день" onClick={() => move(-1)}>←</button><label><span>{new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long' })}</span><input aria-label="Дата тренировки" type="date" value={day} onChange={e => { if (e.target.value) setDay(e.target.value) }} /></label><button className="btn" aria-label="Следующий день" onClick={() => move(1)}>→</button>{!isToday && <button className="btn" onClick={() => setDay(today)}>К сегодняшнему дню</button>}</div>
    {isToday && <details className="today-progress"><summary>Прогресс</summary><MotivationPanel /></details>}
    <div className="today-layout"><div className="today-main">
      <div className="today-toolbar"><details className="today-rest-square"><summary aria-label="Отдых"><span>Отдых</span><strong role="timer">{timer ? time(timer.left) : time(S.restSec || 60)}</strong></summary><div className="today-rest-popup">{timer ? <><button className="btn sm" onClick={() => useUI.getState().addRest(30)}>+30 сек</button><button className="btn sm" onClick={() => useUI.getState().stopRest()}>Я готов</button></> : [60,90,120,180].map(sec => <button className="btn sm" key={sec} onClick={e => { useUI.getState().startRest(sec); e.currentTarget.closest('details').open=false }}>{time(sec)}</button>)}</div></details>
      <section className="today-voice" aria-label="Запись голосом"><div className="today-voice-actions">{<button className={'btn ' + (listening ? '' : 'primary')} disabled={voice.busy} onClick={() => { if (!listening) setDay(today); void (listening ? stopVoice() : startVoice()) }}>{listening ? 'Выключить микрофон' : 'Начать разговор'}</button>}{voice.status !== 'off' && <span role="status">{VOICE_LABELS[voice.status]}</span>}</div>
        {!isToday && <p className="today-note">Голос записывает в текущую тренировку за сегодня. Эта дата — просмотр истории.</p>}
        {voice.hasKey === false && voice.status === 'error' && <VoiceConnection />}
      {voice.error && voice.status === 'error' && <p role="alert" className="today-error">{voice.error}</p>}
        {!!messages.length && <div className="today-transcript" aria-live="polite">{messages.map(m => <p key={m.id}><b>{m.role === 'user' ? 'Ты' : m.role === 'saved' ? 'Дневник' : 'Напарник'}:</b> {m.text}</p>)}</div>}
      </section></div>
      <section className="today-log" aria-label="Записанные подходы"><div className="today-section-heading"><h2>Упражнения</h2><button className="btn sm" onClick={() => nav(isToday ? '/workout' : '/history')}>{isToday ? 'Добавить' : 'Изменить'}</button></div>
        {!completed.length && <div className="today-empty"><span>01</span><h3>Пока ни одного подхода</h3><p>{isToday ? 'Включи микрофон и назови упражнение, вес и повторы. Заранее создавать программу не нужно.' : 'За выбранный день выполненных подходов нет.'}</p>{isToday && <button className="btn" onClick={() => nav('/library')}>Посмотреть упражнения</button>}</div>}
        {sessions.map(w => <div className="today-session" key={w.id}>{w.entries.map((e, i) => { if (!e.sets.some(s => s.done)) return null; return <ExerciseCard key={`${e.id}-${i}`} entry={e} state={S} editable={w === S.active} onEdit={async () => { if (w === S.active) { try { await useStore.getState().update(s => { if (s.active?.id === w.id) s.active.cur = i }); nav('/workout') } catch { useUI.getState().toast('Не удалось открыть упражнение. Попробуй ещё раз.') } } else nav('/history') }} /> })}</div>)}
      </section>
      {isToday && S.active?.d === today && <div className="today-finish"><button className="btn primary" disabled={!canFinish || finishing} onClick={() => { void finish() }}>{finishing ? 'Сохраняю…' : 'Завершить тренировку'}</button></div>}
    </div></div>
  </div>
}
