import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Switch } from '../components/ui.jsx'
import { desktop, DESKTOP_DEFAULTS } from './platform.js'
import { openHomePlan } from './DesktopHome.jsx'

export default function DesktopSettings() {
  const S = useStore(s => s.S), update = useStore(s => s.update), save = useStore(s => s.desktopSave)
  const nav = useNavigate(), toast = useUI(s => s.toast)
  const [info, setInfo] = useState(null), [media, setMedia] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    desktop().info().then(setInfo).catch(e => setError(e.message))
    desktop().mediaStatus().then(setMedia).catch(e => setError(e.message))
    return desktop().onMediaProgress(setMedia)
  }, [])
  const run = async fn => { setBusy(true); setError(''); try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const exportBackup = () => run(async () => { const result = await desktop().exportBackup(); if (!result.canceled) toast('Резервная копия сохранена') })
  const importBackup = () => run(async () => {
    const state = await desktop().importBackup()
    if (!state) return
    confirmSheet({ title: 'Восстановить резервную копию?', message: `В файле: ${state.routines.length} программ и ${state.workouts.length} тренировок. Они заменят текущие данные. Перед заменой сохраним текущую версию в папке backups.`, confirmText: 'Восстановить', onConfirm: () => run(async () => {
      await desktop().restoreBackup(state)
      useStore.getState().replaceState({ ...structuredClone(DEF), ...structuredClone(DESKTOP_DEFAULTS), ...state })
      toast('Данные восстановлены')
    }) })
  })
  const mediaPercent = media?.total ? Math.round(media.completed / media.total * 100) : 0
  return <div className="desk-settings">
    <div className="desk-page-heading"><div><h1>Настройки</h1><p>Профиль, тренировки и локальные данные.</p></div><span className="desk-badge">Windows · {info?.version || '1.0.0'}</span></div>
    {(error || save.status === 'error') && <div className="desk-alert" role="alert"><div><b>Действие не выполнено</b><p>{error || save.message}</p></div><button className="btn sm" onClick={() => run(async () => { await desktop().save(useStore.getState().S); useStore.setState({ desktopSave: { status: 'saved' } }) })}>Повторить сохранение</button></div>}
    <div className="desk-settings-grid"><div>
      <section className="desk-panel"><div className="desk-panel-heading"><h2>Профиль и внешний вид</h2><Icon name="person" /></div><label className="desk-field">Как тебя называть<input className="input" maxLength={40} placeholder="Имя (необязательно)" value={S.desktopName || ''} onChange={e => update(s => { s.desktopName = e.target.value })} /></label>
        <div className="desk-setting-row"><div><b>Тема</b><small>Светлая, тёмная или как в Windows</small></div><select aria-label="Тема" value={S.theme} onChange={e => update(s => { s.theme = e.target.value })}><option value="light">Светлая</option><option value="dark">Тёмная</option><option value="system">Системная</option></select></div>
        <div className="desk-setting-row"><div><b>Вид тренировки</b><small>Все упражнения или одно за раз</small></div><select aria-label="Вид тренировки" value={S.workoutView} onChange={e => update(s => { s.workoutView = e.target.value })}><option value="list">Список</option><option value="cards">По одному</option><option value="compact">Компактный</option></select></div>
      </section>
      <section className="desk-panel"><div className="desk-panel-heading"><h2>Во время тренировки</h2><Icon name="timer" /></div><div className="desk-setting-row"><div><b>Отдых между подходами</b><small>Можно переопределить для упражнения</small></div><select aria-label="Отдых" value={S.restSec} onChange={e => update(s => { s.restSec = Number(e.target.value) })}>{[30,45,60,75,90,120,180].map(n => <option key={n} value={n}>{n} сек</option>)}</select></div>
        <div className="desk-setting-row"><div><b>Звук таймера</b><small>Сигнал по окончании отдыха</small></div><Switch aria-label="Звук таймера" checked={S.sound} onChange={v => update(s => { s.sound = v })} /></div>
        <div className="desk-setting-row"><div><b>Вспышка экрана</b><small>Визуальный сигнал, если звук выключен</small></div><Switch aria-label="Вспышка экрана" checked={S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} /></div>
        <div className="desk-setting-row"><div><b>Спрашивать вес перед тренировкой</b><small>Вес тела можно записывать и в обзоре</small></div><Switch aria-label="Спрашивать вес перед тренировкой" checked={S.weighIn} onChange={v => update(s => { s.weighIn = v })} /></div>
        <button className="desk-link-row" onClick={() => nav('/settings/advanced')}>Все настройки тренировок<Icon name="arrowRight" /></button>
      </section>
      <section className="desk-panel"><div className="desk-panel-heading"><h2>Домашние программы</h2><Icon name="dumbbell" /></div><p className="desk-helper">Гантели и дорожка, три дня в неделю. Посмотри состав перед добавлением, затем меняй план под себя.</p><button className="btn" onClick={openHomePlan}>Посмотреть программы</button></section>
    </div><div>
      <section className="desk-panel"><div className="desk-panel-heading"><h2>Данные и резервные копии</h2><Icon name="lock" /></div><p className="desk-helper">Каждое изменение записывается в файл. Предыдущая версия и до 30 резервных копий сохраняются автоматически. Для защиты от поломки диска экспортируй копию в другое место.</p><div className="desk-setting-actions"><button className="btn" disabled={busy} onClick={exportBackup}><Icon name="download" />Экспортировать</button><button className="btn" disabled={busy} onClick={importBackup}><Icon name="upload" />Восстановить</button></div><button className="desk-link-row" onClick={() => run(() => desktop().openDataFolder())}>Открыть папку данных<Icon name="arrowRight" /></button><code className="desk-path">{info?.dataDir || 'Определяю папку…'}</code></section>
      <section className="desk-panel"><div className="desk-panel-heading"><h2>Упражнения офлайн</h2><span className="desk-badge">{media?.state === 'ready' ? 'Загружено' : `${mediaPercent}%`}</span></div><p className="desk-helper">Скачай изображения и анимации один раз. После этого они доступны без интернета. Инструкции и сами тренировки работают и без загрузки медиа.</p><div className="desk-progress"><span style={{ width: `${mediaPercent}%` }} /></div><p className="desk-helper" role="status">{media?.completed || 0} / {media?.total || '…'} файлов{media?.state === 'error' ? ` · не удалось загрузить: ${media.errors}. Можно повторить.` : media?.state === 'paused' ? ' · загрузка приостановлена' : media?.state === 'downloading' ? ' · скачивание…' : ''}</p>
        {media?.state === 'downloading' ? <button className="btn" onClick={() => run(() => desktop().pauseMedia())}>Приостановить</button> : media?.state !== 'ready' ? <button className="btn" disabled={!media || busy} onClick={() => run(async () => setMedia(await desktop().downloadMedia()))}><Icon name="download" />{media?.completed ? 'Продолжить загрузку' : 'Скачать медиа · ~140 МБ'}</button> : <div className="desk-ready"><Icon name="checkCircle" />Библиотека доступна без интернета</div>}
        <p className="desk-media-note">Медиа загружается из exercises-dataset на GitHub. Это сторонний контент со своими условиями использования, отдельно от лицензии openGym.</p>
      </section>
      <section className="desk-about"><span className="desk-mark"><Icon name="dumbbell" /></span><div><b>openGym для Windows</b><p>На основе openGym 1.3.8 · AGPL-3.0</p><a href="https://github.com/natural0101/openGym" target="_blank" rel="noreferrer">Исходный код<Icon name="arrowRight" /></a></div></section>
    </div></div>
  </div>
}
