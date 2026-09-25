import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { burgerDay, burgerView } from './burger-game.js'
import { desktop } from './platform.js'

export default function DesktopWidgetBridge() {
  const S = useStore(s => s.S), timer = useUI(s => s.timer), work = useUI(s => s.work), nav = useNavigate()
  useEffect(() => {
    const active = S.active
    desktop().updateWidget({ name: active?.name || 'Тренировка дома', active: !!active, buddy: S.desktopBuddy || 'burger', burger: burgerView(S),
      done: active?.entries.reduce((n,e) => n + e.sets.filter(s => s.done).length, 0) || 0,
      total: active?.entries.reduce((n,e) => n + e.sets.length, 0) || 0,
      timer: work || timer ? { endsAt: (work || timer).endsAt, label: work ? work.label : 'Отдых', kind: work ? 'work' : 'rest' } : null,
    }).catch(() => {})
  }, [S.active, S.desktopBuddy, S.desktopBurger, timer?.endsAt, work?.endsAt])
  useEffect(() => {
    const refresh = () => {
      const state = useStore.getState()
      if (state.S.desktopBurger && !state.S.desktopBurger.won && state.S.desktopBurger.day < burgerDay()) state.update(() => {})
    }
    const id = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(id); window.removeEventListener('focus', refresh) }
  }, [])
  useEffect(() => desktop().onWidgetAction(action => {
    if (action === 'open') nav(useStore.getState().S.active ? '/workout' : '/home')
    if (action === 'warmup') { const ui = useUI.getState(); if (!ui.timer && !ui.work) ui.startWork(120, 'Разминка с Тортиком') }
    if (action === 'skip-rest') useUI.getState().stopRest()
    if (action === 'toggle-buddy') useStore.getState().update(s => { s.desktopBuddy = s.desktopBuddy === 'cake' ? 'burger' : 'cake' })
  }), [nav])
  return null
}
