import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { effectiveRoutines, setsDoneActive } from '../lib/history.js'
import { todayISO, isoOf } from '../lib/format.js'
import { bwSheet, dayOverrideSheet, startFlow } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { EXIDX } from '../lib/exercises.js'
import { HOME_PLANS, HOME_NAMES, buildHomePlan } from './home-plans.js'

export function HomePlanChooser({ close }) {
  const S = useStore(s => s.S)
  const [selected, setSelected] = useState('dumbbells')
  const plan = HOME_PLANS.find(p => p.id === selected)
  const apply = () => {
    const built = buildHomePlan(selected)
    useStore.getState().update(s => {
      s.routines.push(...built.routines)
      // Templates only fill free weekdays; existing assignments are never overwritten.
      built.schedule.forEach(({ day, routineId }) => { if (!s.week[day]?.length) s.week[day] = [routineId] })
      s.desktopPlanAdded = true
    })
    close()
    useUI.getState().toast('Программа добавлена. Дни и упражнения можно изменить в «Мой план».')
  }
  return <div className="desk-plan-preview"><span className="desk-eyebrow">Стартовая программа</span><h3>План для дома</h3><p className="desk-helper">Шаблон для начала. Нагрузку и упражнения подстройте под себя.</p>
    <div className="desk-plan-tabs">{HOME_PLANS.map(p => <button key={p.id} aria-pressed={p.id === selected} className={p.id === selected ? 'on' : ''} onClick={() => setSelected(p.id)}>{p.title}</button>)}</div>
    <p>{plan.description}</p><div className="desk-plan-meta"><Icon name="clock" />{plan.duration}<span>Пн · Ср · Пт</span></div>
    {plan.sessions.map(r => <div className="desk-plan-session" key={r.name}><b>{r.name}</b><p>{r.ex.map(e => HOME_NAMES[e.id] || EXIDX[e.id]?.n).join(' · ')}</p></div>)}
    <p className="desk-helper">Перед силовой частью — 5 минут спокойной ходьбы и разминка суставов. Стартовый вес гантелей не задан: выберите комфортный в тренировке.</p>
    {!!S.routines.length && <p className="desk-helper">Текущие программы сохранятся. Новые занятия займут только свободные дни.</p>}
    <div className="desk-dialog-actions"><button className="btn" onClick={close}>Отмена</button><button className="btn primary" onClick={apply}>Добавить в мой план</button></div>
  </div>
}
export const openHomePlan = () => useUI.getState().openSheet(close => <HomePlanChooser close={close} />, { kind: 'center' })

export default function DesktopHome() {
  const S = useStore(s => s.S), nav = useNavigate()
  const [tab, setTab] = useState('programs')
  const now = new Date(), today = todayISO()
  const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
  const recent = [...S.workouts].sort((a, b) => b.d.localeCompare(a.d) || (b.start || 0) - (a.start || 0)).slice(0, 8)
  const create = () => {
    const id = crypto.randomUUID()
    useStore.getState().update(s => { s.routines.push({ id, name: 'Новая программа', emoji: 'dumbbell', ex: [] }) })
    nav('/plan/r/' + id)
  }
  return <div className="workspace-home">
    <div className="workspace-heading"><div><h1>Домашние тренировки</h1><p>Гантели и беговая дорожка</p></div><button className="btn" onClick={create}><Icon name="plus" />Новая программа</button></div>
    {S.active && <button className="workspace-resume" onClick={() => nav('/workout')}><Icon name="play" /><b>{S.active.name}</b><span>{setsDoneActive(S.active)} подходов выполнено</span><strong>Продолжить тренировку →</strong></button>}
    <div className="workspace-tabs" role="tablist" aria-label="Домашние тренировки">
      {[['programs', 'Программы'], ['week', 'Неделя'], ['recent', 'Последние занятия']].map(([id, text]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{text}{id === 'programs' && <span>{S.routines.length}</span>}</button>)}
      <button className="workspace-template" onClick={openHomePlan}><Icon name="plus" />Домашний шаблон</button>
    </div>
    {tab === 'programs' && <section aria-label="Программы тренировок">
      {S.routines.length ? <>
        <div className="routine-table-head"><span>Программа</span><span>Расписание</span><span>Последнее занятие</span><span /></div>
        {S.routines.map(r => {
          const days = [1,2,3,4,5,6,0].filter(d => [].concat(S.week[d] || []).includes(r.id))
          const last = [...S.workouts].filter(w => w.routineIds?.includes(r.id)).sort((a,b) => b.d.localeCompare(a.d))[0]
          return <div className="routine-table-row" key={r.id}>
            <button className="routine-table-name" onClick={() => nav('/plan/r/' + r.id)}><Icon name={r.ex.every(e => e.mode === 'cardio') && r.ex.length ? 'figureRun' : 'dumbbell'} /><div><b>{r.name}</b><small>{r.ex.length} упражнений{r.ex.length ? ' · ' + r.ex.map(e => HOME_NAMES[e.id] || EXIDX[e.id]?.n).slice(0,2).join(', ') : ' · добавь упражнения'}</small></div></button>
            <span className="routine-table-schedule">{days.length ? days.map(d => weekdays[d]).join(', ') : 'Без расписания'}</span>
            <span className="routine-table-last">{last ? new Date(last.d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Ещё не было'}</span>
            <button className="routine-table-start" disabled={!r.ex.length || !!S.active} title={S.active ? 'Сначала заверши текущую тренировку' : undefined} onClick={() => startFlow([r.id])}><Icon name="play" />Начать</button>
          </div>
        })}
        <button className="workspace-add-row" onClick={create}><Icon name="plus" />Добавить программу</button>
      </> : <div className="workspace-empty"><h2>Пока нет программ</h2><p>Добавь готовый план для гантелей и дорожки.<br />Упражнения, нагрузку и дни можно изменить.</p><button className="btn primary" onClick={openHomePlan}>Подобрать домашний план</button><button className="btn ghost" onClick={() => nav('/workout')}>Начать без плана</button></div>}
      <div className="workspace-help-row"><Icon name="info" /><span>Выбирай комфортный вес гантелей. Перед силовой частью — спокойная ходьба и разминка.</span></div>
    </section>}
    {tab === 'week' && <section className="workspace-week">{Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(d.getDate()+i); const iso = isoOf(d), plans = effectiveRoutines(S, iso), done = S.workouts.some(w => w.d === iso)
      return <button key={iso} onClick={() => dayOverrideSheet(iso)} className={iso === today ? 'today' : ''}><span className="week-date">{d.toLocaleDateString('ru-RU', { weekday:'short' })}<b>{d.getDate()}</b></span><span>{plans.length ? plans.map(r => r.name).join(' + ') : 'Отдых'}</span><small>{done ? 'Выполнено' : iso === today ? 'Сегодня' : ''}</small><Icon name={done ? 'check' : 'chevronRight'} /></button>
    })}<button className="workspace-add-row" onClick={() => nav('/plan')}>Изменить недельное расписание<Icon name="arrowRight" /></button></section>}
    {tab === 'recent' && <section>{recent.length ? recent.map(w => <button key={w.id} className="workspace-history-row" onClick={() => nav('/history')}><Icon name="checkCircle" /><b>{w.name}</b><span>{new Date(w.d+'T12:00:00').toLocaleDateString('ru-RU')}</span><Icon name="chevronRight" /></button>) : <div className="workspace-empty"><h2>Занятий ещё нет</h2><p>Завершённые тренировки появятся здесь.</p></div>}</section>}
    <footer className="workspace-footer"><span>Данные на этом компьютере</span><button onClick={() => bwSheet()}><Icon name="scale" />Записать вес</button><button onClick={() => nav('/settings')}>Резервные копии<Icon name="arrowRight" /></button></footer>
  </div>
}
