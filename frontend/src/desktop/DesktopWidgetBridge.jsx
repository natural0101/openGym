import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { burgerDay, burgerView } from './burger-game.js'
import { desktop } from './platform.js'
import { useVoice, startVoice, stopVoice } from './voice-client.js'
import { motivation } from './motivation.js'
import { exerciseLabel } from './exercise-labels.js'
import { exOr } from '../lib/exercises.js'

export default function DesktopWidgetBridge() {
  const S = useStore(s => s.S), timer = useUI(s => s.timer), work = useUI(s => s.work), nav = useNavigate()
  const [minute,setMinute]=useState(0)
  useEffect(()=>{const id=setInterval(()=>setMinute(n=>n+1),60000);return()=>clearInterval(id)},[])
  useEffect(() => {
    const active = S.active
    const m=motivation(S),g=m.growth[0],unit=S.unit==='lb'?'фунт.':'кг'
    desktop().updateWidget({ name: active?.name || 'Тренировка дома', active: !!active, buddy: S.desktopBuddy || 'burger', burger: burgerView(S),
      widgetMode: S.desktopWidgetMode || 'simple',
      motivation: {...m, growth:g?`${exerciseLabel(S,exOr(g.exerciseId))}: +${Number(g.delta.toFixed(2))} ${g.kind==='reps'?'повт.':unit}`:m.hasHistory?'Продолжай в своём темпе.':'Первые записи — точка отсчёта.'},
      done: active?.entries.reduce((n,e) => n + e.sets.filter(s => s.done).length, 0) || 0,
      total: active?.entries.reduce((n,e) => n + e.sets.length, 0) || 0,
      timer: work || timer ? { endsAt: (work || timer).endsAt, label: work ? work.label : 'Отдых', kind: work ? 'work' : 'rest' } : null,
    }).catch(() => {})
  }, [S, minute, timer?.endsAt, work?.endsAt])
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
    if (action === 'voice') {
      const v = useVoice.getState()
      if (!['off', 'error'].includes(v.status)) { void stopVoice(); return }
      nav('/home')
      void startVoice()
    }
    if (action === 'open') nav(useStore.getState().S.active ? '/workout' : '/home')
    if (action === 'warmup') { const ui = useUI.getState(); if (!ui.timer && !ui.work) ui.startWork(120, 'Разминка с Тортиком') }
    if (action === 'skip-rest') useUI.getState().stopRest()
    if (action === 'toggle-buddy') useStore.getState().update(s => { s.desktopBuddy = s.desktopBuddy === 'cake' ? 'burger' : 'cake' })
  }), [nav])
  return null
}
