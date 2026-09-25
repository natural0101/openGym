import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import DesktopWidgetBridge from './DesktopWidgetBridge.jsx'

const links = [
  ['/home', 'house', 'Обзор'], ['/plan', 'calendar', 'Мой план'], ['/workout', 'dumbbell', 'Тренировка'],
  ['/library', 'list', 'Упражнения'], ['/history', 'history', 'Журнал'], ['/stats', 'chart', 'Прогресс'],
]

export default function DesktopShell() {
  const nav = useNavigate(), loc = useLocation()
  const S = useStore(s => s.S), save = useStore(s => s.desktopSave)
  const [searching, setSearching] = useState(false), [query, setQuery] = useState('')
  const searchRef = useRef(null), commandRef = useRef(null)
  const current = links.find(([path]) => loc.pathname.startsWith(path))?.[2] || (loc.pathname.includes('settings') ? 'Настройки' : 'Упражнения')
  useEffect(() => {
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(v => !v) }
      if (e.key === 'Escape') setSearching(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => { if (searching) { setQuery(''); searchRef.current?.focus() } }, [searching])
  const go = route => { setSearching(false); nav(route) }
  const choices = [...links, ['/settings', 'gear', 'Настройки'], ...S.routines.map(r => ['/plan/r/' + r.id, 'dumbbell', r.name])]
    .filter(([, , label]) => label.toLowerCase().includes(query.toLowerCase()))
  const status = save.status === 'saving' ? 'Сохраняю…' : save.status === 'error' ? 'Ошибка сохранения' : save.status === 'loading' ? 'Открываю данные…' : 'Всё сохранено'
  return <>
    <DesktopWidgetBridge />
    <a className="desk-skip" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('app')?.focus() }}>Перейти к содержимому</a>
    <aside className="desk-sidebar">
      <button className="desk-brand" onClick={() => nav('/home')} aria-label="openGym — обзор"><span className="desk-mark"><img src="./desktop-logo.svg" alt="" /></span><span>openGym</span></button>
      <button className="desk-search" onClick={() => setSearching(true)}><Icon name="magnifier" /><span>Найти раздел</span><kbd>Ctrl K</kbd></button>
      <div className="desk-nav-label">Твой зал</div>
      <nav aria-label="Основная навигация">{links.map(([path, icon, label]) => <button key={path} aria-label={label} title={label} className={'desk-nav-item' + (loc.pathname.startsWith(path) ? ' selected' : '')} aria-current={loc.pathname.startsWith(path) ? 'page' : undefined} onClick={() => nav(path)}><Icon name={icon} /><span>{label}</span>{path === '/workout' && S.active && <i className="desk-live" />}</button>)}</nav>
        <div className="desk-sidebar-routines"><div className="desk-nav-label">Программы</div>{S.routines.map(r => <button key={r.id} title={r.name} onClick={() => nav('/plan/r/' + r.id)}><Icon name="dumbbell" /><span>{r.name}</span></button>)}</div>
      <div className="desk-sidebar-bottom">

        <button aria-label="Настройки" title="Настройки" className={'desk-nav-item' + (loc.pathname.startsWith('/settings') ? ' selected' : '')} onClick={() => nav('/settings')}><Icon name="gear" /><span>Настройки</span></button>
        <div className="desk-profile"><span className="desk-avatar"><Icon name="house" /></span><div>{S.desktopName || 'Мой профиль'}<small>Гантели и дорожка</small></div><span className="desk-offline-dot" title="Локальное сохранение" /></div>
      </div>
    </aside>
    <header className="desk-topbar"><div><span className="desk-breadcrumb">openGym</span><span className="desk-slash">/</span><b>{current}</b></div><div className={'desk-save ' + save.status} role="status"><Icon name={save.status === 'error' ? 'warning' : 'checkCircle'} /><span>{status}</span></div></header>
    {searching && <div className="desk-command-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSearching(false) }}>
      <div className="desk-command" role="dialog" aria-modal="true" aria-label="Быстрый переход" ref={commandRef} onKeyDown={e => {
        if (e.key === 'Tab') {
          const items = [...commandRef.current.querySelectorAll('input,button')]
          if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus() }
          else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus() }
        }
      }}>
        <div className="desk-command-input"><Icon name="magnifier" /><input ref={searchRef} placeholder="Найти раздел или программу…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && choices.length) go(choices[0][0]); if (e.key === 'ArrowDown') { e.preventDefault(); commandRef.current.querySelector('button')?.focus() } }} /><button onClick={() => setSearching(false)} aria-label="Закрыть поиск"><kbd>Esc</kbd></button></div>
        <div className="desk-command-results">{choices.length ? choices.map(([route, icon, label]) => <button key={route} onClick={() => go(route)}><Icon name={icon} /><span>{label}</span><Icon name="chevronRight" /></button>) : <p>Ничего не найдено. Попробуйте «план» или «журнал».</p>}</div>
      </div>
    </div>}
  </>
}

export function DesktopSaveError() {
  const save = useStore(s => s.desktopSave)
  const recovered = useStore(s => s.desktopRecovered)
  const nav = useNavigate()
  if (save.status !== 'error' && !recovered) return null
  return <div className="desk-alert" role="alert"><div><b>{save.status === 'error' ? 'Не удалось сохранить данные' : 'Восстановлена резервная копия'}</b><p>{save.status === 'error' ? save.message : 'Основной файл был повреждён. Проверьте последние записи; исходный файл сохранён отдельно.'}</p></div><button className="btn sm" onClick={() => nav('/settings')}>Открыть настройки</button></div>
}
