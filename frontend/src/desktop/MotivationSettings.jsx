import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { Switch } from '../components/ui.jsx'
import { desktop } from './platform.js'

function useMotivation() {
  const [info, setInfo] = useState(null), [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    const refresh = () => desktop().motivationInfo().then(value => { if (alive) setInfo(value) }).catch(e => { if (alive) setError(e.message) })
    void refresh()
    const unsubscribe = desktop().onMotivationChanged(refresh)
    return () => { alive = false; unsubscribe() }
  }, [])
  return { info, error, setError }
}

export default function MotivationSettings() {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const { info, error, setError } = useMotivation()
  const [busy, setBusy] = useState(false), [time, setTime] = useState('18:00')
  useEffect(() => { if (info?.reminder.time) setTime(info.reminder.time) }, [info?.reminder.time])
  const run = async action => { setBusy(true); setError(''); try { await action() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const saveReminder = enabled => run(() => desktop().reminderConfigure({ enabled, time }))
  return <section className="desk-panel" aria-label="Ритм тренировок и виджет">
    <h2>В своём темпе</h2>
    {(error || info?.error) && <p className="desk-helper" role="alert">{error || info.error}</p>}
    <div className="desk-setting-row"><div><b>Цель на неделю</b><small>Количество дней с тренировкой. Меняй под своё расписание.</small></div><select aria-label="Цель тренировочных дней на неделю" disabled={busy} value={S.desktopWeeklyGoal ?? 3} onChange={e => { const value = Number(e.target.value); void run(() => update(s => { s.desktopWeeklyGoal = value })) }}>{[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'}</option>)}</select></div>
    <div className="desk-setting-row"><div><b>Напомнить о тренировке</b><small>Одно тихое уведомление в выбранное время. После выполненного подхода сегодня не напоминаем.</small></div><Switch aria-label="Ежедневное напоминание" checked={info?.reminder.enabled === true} disabled={!info || busy} onChange={enabled => { void saveReminder(enabled) }} /></div>
    <label className="desk-field">Время по часам Windows<input className="input" type="time" aria-label="Время напоминания" value={time} disabled={!info || busy} onChange={e => setTime(e.target.value)} onBlur={() => { if (info && time !== info.reminder.time) void saveReminder(info.reminder.enabled) }} /></label>
    <p className="desk-helper">Напоминание работает, пока openGym запущен. Можно выбрать «Позже» на 30 минут или «Сегодня отдых» — без повторных напоминаний на этот день.</p>
    <div className="desk-setting-row"><div><b>Виджет при входе в Windows</b><small>Запускается только виджет. Главное окно скрыто, микрофон выключен.</small></div><Switch aria-label="Запуск виджета при входе в Windows" checked={info?.startup.enabled === true} disabled={!info?.startup.available || busy} onChange={enabled => { void run(() => desktop().startupConfigure(enabled)) }} /></div>
    {info && !info.startup.available && <p className="desk-helper">Автозапуск доступен в установленной версии для Windows.</p>}
    <div className="desk-setting-row"><div><b>Вид виджета</b><small>Спокойная сводка или персонаж-напарник</small></div><select aria-label="Вид виджета" disabled={busy} value={S.desktopWidgetMode || 'simple'} onChange={e => { const value = e.target.value; void run(() => update(s => { s.desktopWidgetMode = value })) }}><option value="simple">Простой</option><option value="buddy">С напарником</option></select></div>
  </section>
}

export function MotivationReminderBanner() {
  const { info, error, setError } = useMotivation(), [busy, setBusy] = useState(false), nav = useNavigate()
  const S = useStore(s => s.S)
  const date = new Date(), today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  const activity = w => w?.d === today && w.entries?.some(e => e.sets?.some(s => s.done || s.sides?.L?.done || s.sides?.R?.done))
  if (!info?.reminder.pending || activity(S.active) || S.workouts.some(activity)) return null
  const act = async action => { setBusy(true); setError(''); try { await desktop().reminderAction(action); if (action === 'open') nav('/home') } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <aside className="desk-panel" aria-label="Напоминание о тренировке" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 80, maxWidth: 'min(430px, calc(100vw - 48px))', margin: 0 }}>
    <h2>Немного времени для себя</h2><p className="desk-helper">Есть силы позаниматься? Начни с одного подхода. День отдыха тоже можно выбрать.</p>
    <div className="desk-setting-actions"><button className="btn primary" disabled={busy} onClick={() => { void act('open') }}>К тренировке</button><button className="btn" disabled={busy} onClick={() => { void act('later') }}>Позже · 30 мин</button><button className="btn" disabled={busy} onClick={() => { void act('rest') }}>Сегодня отдых</button></div>
    {error && <p role="alert">{error}</p>}
  </aside>
}
