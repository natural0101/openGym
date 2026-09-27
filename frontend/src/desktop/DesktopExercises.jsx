import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { allExercises, equipmentOf, BODYPARTS } from '../lib/exercises.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import Media, { Thumb } from '../components/Media.jsx'
import { exerciseLabel, matchesPersonalExercise } from './exercise-labels.js'
import { exerciseRest } from './rest-policy.js'
import './exercises.css'

export default function DesktopExercises() {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [browse, setBrowse] = useState(false), [query, setQuery] = useState('')
  const [equipment, setEquipment] = useState(''), [body, setBody] = useState(''), [shown, setShown] = useState(30)
  const [selected, setSelected] = useState(null), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [rest, setRest] = useState('')
  const restDefault = selected ? exerciseRest(selected) : null
  const favorites = S.desktopFavorites || [], catalogue = allExercises(S)
  const filtered = catalogue.filter(ex => (browse || favorites.includes(ex.id)) && (!equipment || ex.eq === equipment) && (!body || ex.bp === body) && (
    matchesPersonalExercise(S, ex, query) || [exerciseNameFor(ex), t(ex.eq), t(ex.bp), t(ex.tg)].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  )).sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)))
  const choose = ex => { setSelected(ex); setName(exerciseLabel(S, ex)); setRest(S.desktopRestOverrides?.[ex.id] ?? ''); setError('') }
  const save = async () => {
    if (!name.trim()) { setError('Напиши, как ты называешь это упражнение.'); return }
    const interval = rest === '' ? null : Number(rest)
    if (interval !== null && (!Number.isInteger(interval) || interval < 5 || interval > 3600)) { setError('Укажи целое число от 5 до 3600 секунд или оставь поле пустым.'); return }
    setBusy(true); setError('')
    try {
      await update(s => {
        s.desktopExerciseNames = { ...s.desktopExerciseNames, [selected.id]: name.trim() }
        s.desktopRestOverrides = { ...s.desktopRestOverrides }
        if (interval === null) delete s.desktopRestOverrides[selected.id]
        else s.desktopRestOverrides[selected.id] = interval
        s.desktopFavorites = [...new Set([...(s.desktopFavorites || []), selected.id])]
      })
      setSelected(null)
    } catch { setError('Не удалось сохранить. Попробуй ещё раз.') } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError('')
    try { await update(s => { s.desktopFavorites = (s.desktopFavorites || []).filter(id => id !== selected.id) }); setSelected(null) }
    catch { setError('Не удалось сохранить. Попробуй ещё раз.') } finally { setBusy(false) }
  }
  return <div className="desk-exercises">
    <div className="desk-page-heading"><div><h1>Мои упражнения</h1><p>Выбери знакомые движения и назови их своими словами для напарника.</p></div><button className="btn" onClick={() => { setBrowse(!browse); setShown(30); setQuery(''); setEquipment(''); setBody('') }}>{browse ? 'Мой список' : 'Добавить из каталога'}</button></div>
    <div className="desk-exercise-filters"><input className="input" aria-label="Поиск упражнений" placeholder="Название упражнения…" value={query} onChange={e => { setQuery(e.target.value); setShown(30) }} />
      <select aria-label="Инвентарь" value={equipment} onChange={e => { setEquipment(e.target.value); setShown(30) }}><option value="">Любой инвентарь</option>{equipmentOf(catalogue).map(eq => <option key={eq} value={eq}>{t(eq)}</option>)}</select>
      <select aria-label="Группа мышц" value={body} onChange={e => { setBody(e.target.value); setShown(30) }}><option value="">Все группы мышц</option>{BODYPARTS.map(bp => <option key={bp} value={bp}>{t(bp)}</option>)}</select></div>
    <div className="desk-exercise-layout"><section className="desk-panel"><h2>{browse ? 'Каталог упражнений' : 'Мой список'} <span className="desk-badge">{filtered.length}</span></h2>
      {!filtered.length && <p className="desk-helper">{!browse && !favorites.length ? 'Пока пусто. Открой каталог, посмотри анимацию и добавь упражнения, которые делаешь.' : 'Ничего не найдено. Попробуй другое название или убери фильтры.'}</p>}
      <div className="desk-exercise-list">{filtered.slice(0, shown).map(ex => <button className={'desk-exercise-row' + (selected?.id === ex.id ? ' selected' : '')} key={ex.id} onClick={() => choose(ex)}><Thumb ex={ex} /><span><b>{exerciseLabel(S, ex)}</b><small>{t(ex.bp)} · {t(ex.eq)}{favorites.includes(ex.id) ? ' · В моём списке' : ''}</small></span><span aria-hidden="true">→</span></button>)}</div>
      {filtered.length > shown && <button className="btn" onClick={() => setShown(shown + 30)}>Показать ещё</button>}
    </section><aside className="desk-panel desk-exercise-preview">{selected ? <><h2>{exerciseLabel(S, selected)}</h2><Media key={selected.id} ex={selected} />{!selected.gif && <p className="desk-helper">Для этого упражнения нет анимации.</p>}<label className="desk-field">Как я называю упражнение<input className="input" value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Например: жим гантелей лёжа" /></label><p className="desk-helper">Напарник будет ориентироваться на это название. Записи прошлых тренировок сохраняются.</p>{restDefault && <><label className="desk-field">Мой отдых между подходами, сек<input className="input" type="number" min="5" max="3600" step="1" value={rest} onChange={e => setRest(e.target.value)} placeholder={String(restDefault.seconds)} /></label><p className="desk-helper">Пустое поле — автоматически: {restDefault.seconds} сек. {restDefault.reason}. После тяжёлого подхода можно попросить больше времени.</p></>}{error && <p role="alert">{error}</p>}<div className="desk-exercise-actions"><button className="btn" disabled={busy} onClick={save}>{busy ? 'Сохраняю…' : favorites.includes(selected.id) ? 'Сохранить название' : 'Добавить в мой список'}</button>{favorites.includes(selected.id) && <button className="btn" disabled={busy} onClick={remove}>Убрать из списка</button>}</div></> : <><h2>Посмотри движение</h2><p className="desk-helper">Нажми на упражнение слева — здесь появится анимация и поле для твоего названия.</p></>}</aside></div>
  </div>
}
