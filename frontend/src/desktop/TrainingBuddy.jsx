import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Icon from '../components/Icon.jsx'
import { desktop } from './platform.js'

export default function TrainingBuddy({ compact = false }) {
  const S = useStore(s => s.S), timer = useUI(s => s.timer), work = useUI(s => s.work), nav = useNavigate()
  const [reaction, setReaction] = useState(false), previous = useRef(null)
  const done = S.active?.entries.reduce((n,e) => n + e.sets.filter(s => s.done).length, 0) || 0
  const total = S.active?.entries.reduce((n,e) => n + e.sets.length, 0) || 0
  const selected = S.desktopBuddy || 'burger'
  useEffect(() => {
    if (previous.current != null && done > previous.current) { setReaction('set'); const id = setTimeout(() => setReaction(false), 1400); previous.current = done; return () => clearTimeout(id) }
    previous.current = done
  }, [done])
  const choose = buddy => { useStore.getState().update(s => { s.desktopBuddy = buddy }); setReaction('choose'); setTimeout(() => setReaction(false), 900) }
  const warmup = () => { if (!work && !timer) useUI.getState().startWork(120, 'Разминка с Тортиком'); nav('/workout') }
  const showWidget = async () => { try { await desktop().showWidget(); useUI.getState().toast('Виджет открыт на рабочем столе. Его можно перетаскивать за верхнюю панель.') } catch (e) { useUI.getState().toast('Не удалось открыть виджет: ' + e.message) } }
  const clock = work || timer
  return <section className={'training-buddy' + (compact ? ' compact' : '') + (reaction ? ' cheering' : '')} aria-label="Твои напарники">
    <div className="buddy-label"><span>Твоя команда</span><span className="buddy-online" /> </div>
    <h2>{reaction === 'set' ? 'Есть ещё подход!' : timer ? 'Пора выдохнуть' : work ? (work.label?.startsWith('Разминка') ? 'Разогреваемся' : 'Работаем') : S.active ? 'В твоём темпе' : 'Вместе веселее'}</h2>
    <div className="buddy-characters">{[['burger','Бургер'],['cake','Тортик']].map(([id,label]) => <button key={id} className={'buddy-pick ' + id} aria-label={'Выбрать: ' + label} aria-pressed={selected === id} onClick={() => choose(id)}><img src={'./mascots/'+id+'.png'} alt={label} /><span>{label}{selected === id && <Icon name="check" />}</span></button>)}</div>
    <div className="buddy-speech" aria-live="polite">{clock ? <><b>{Math.floor(clock.left/60)}:{String(clock.left%60).padStart(2,'0')}</b><span>{work ? work.label : 'Отдых между подходами'}</span></> : S.active ? <><b>{done} / {total}</b><span>подходов выполнено</span></> : <p>Бургер поддержит в подходах.<br />Тортик поможет с разминкой.</p>}</div>
    {!compact && <div className="buddy-actions"><button className="btn primary" onClick={() => nav('/workout')}><Icon name={S.active ? 'play' : 'dumbbell'} />{S.active ? 'К тренировке' : 'Выбрать тренировку'}</button><button className="btn" disabled={!!clock} onClick={warmup}><Icon name="timer" />Разминка · 2 минуты</button></div>}
    <button className="buddy-widget" onClick={showWidget}><Icon name="expand" />На рабочий стол<Icon name="arrowRight" /></button>
  </section>
}
