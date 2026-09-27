import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { allExercises } from '../lib/exercises.js'
import Media, { Thumb } from '../components/Media.jsx'
import instructionsRu from '../instr/ru.js'
import russianNames from '../exercise-names/ru.js'
import { exerciseLabel, matchesPersonalExercise } from './exercise-labels.js'
import { exerciseRest } from './rest-policy.js'
import { GROUPS, SOURCE_CONFLICTS, exerciseGroup, isHomeExercise, muscleLabel, equipmentLabel } from './catalogue-groups.js'
import './exercises.css'

export default function DesktopExercises() {
  const S = useStore(s => s.S), update = useStore(s => s.update)
  const [browse, setBrowse] = useState(true), [query, setQuery] = useState(''), [homeOnly, setHomeOnly] = useState(true)
  const [equipment, setEquipment] = useState(''), [group, setGroup] = useState(''), [shown, setShown] = useState(24)
  const [selected, setSelected] = useState(null), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [savedMessage,setSavedMessage] = useState('')
  const [rest, setRest] = useState(''), preview = useRef(null)
  const favorites = S.desktopFavorites || [], catalogue = allExercises(S)
  const scoped = catalogue.filter(ex => (browse || favorites.includes(ex.id)) && (!homeOnly || isHomeExercise(ex)) && (!equipment || ex.eq===equipment) && matchesPersonalExercise(S,ex,query))
  const filtered = scoped.filter(ex => !group || exerciseGroup(ex)===group).sort((a,b)=>Number(favorites.includes(b.id))-Number(favorites.includes(a.id)) || exerciseLabel(S,a).localeCompare(exerciseLabel(S,b),'ru'))
  const counts = Object.fromEntries(GROUPS.map(g=>[g.id,scoped.filter(ex=>exerciseGroup(ex)===g.id).length]))
  const equipmentOptions = [...new Set(catalogue.filter(ex=>!homeOnly||isHomeExercise(ex)).map(ex=>ex.eq))].sort((a,b)=>equipmentLabel(a).localeCompare(equipmentLabel(b),'ru'))
  useEffect(()=>{if(selected&&!filtered.some(ex=>ex.id===selected.id))setSelected(null)},[browse,query,homeOnly,equipment,group])
  const restDefault = selected ? exerciseRest(selected) : null
  const choose = ex => { setSelected(ex);setName(exerciseLabel(S,ex));setRest(S.desktopRestOverrides?.[ex.id] ?? '');setError('');setSavedMessage('');if(innerWidth<1050)requestAnimationFrame(()=>preview.current?.scrollIntoView({behavior:'smooth',block:'start'})) }
  const save = async () => {
    if(!name.trim()){setError('Напиши, как ты называешь это упражнение.');return}
    const interval = rest==='' ? null : Number(rest)
    if(interval!==null&&(!Number.isInteger(interval)||interval<5||interval>3600)){setError('Укажи целое число от 5 до 3600 секунд или оставь поле пустым.');return}
    setBusy(true);setError('');setSavedMessage('')
    try{await update(s=>{
      s.desktopExerciseNames={...s.desktopExerciseNames,[selected.id]:name.trim()}
      s.desktopRestOverrides={...s.desktopRestOverrides}
      if(interval===null)delete s.desktopRestOverrides[selected.id];else s.desktopRestOverrides[selected.id]=interval
      s.desktopFavorites=[...new Set([...(s.desktopFavorites||[]),selected.id])]
    });setSavedMessage('Сохранено. Напарник знает это название.')}catch{setError('Не удалось сохранить. Попробуй ещё раз.')}finally{setBusy(false)}
  }
  const remove = async () => {setBusy(true);setError('');try{await update(s=>{s.desktopFavorites=(s.desktopFavorites||[]).filter(id=>id!==selected.id)});setSavedMessage('Убрано из моего списка. Записи тренировок сохранены.')}catch{setError('Не удалось сохранить. Попробуй ещё раз.')}finally{setBusy(false)}}
  const reset=()=>{setGroup('');setEquipment('');setQuery('');setShown(24)}
  const instructions=selected ? instructionsRu[selected.id] || selected.st || [] : []
  return <div className="desk-exercises">
    <div className="desk-page-heading"><div><h1>Мои упражнения</h1><p>Найди движение, посмотри технику и назови его своими словами.</p></div><span className="desk-badge">{catalogue.length} упражнений</span></div>
    <div className="catalogue-toolbar"><div className="catalogue-tabs" aria-label="Список упражнений"><button className={browse?'selected':''} aria-pressed={browse} onClick={()=>{setBrowse(true);reset()}}>Каталог</button><button className={!browse?'selected':''} aria-pressed={!browse} onClick={()=>{setBrowse(false);setHomeOnly(false);reset()}}>Мой список · {favorites.length}</button></div><button className={'btn '+(homeOnly?'primary':'')} aria-pressed={homeOnly} onClick={()=>{setHomeOnly(!homeOnly);setEquipment('');setShown(24)}}>Гантели, свой вес и дорожка</button></div>
    <div className="desk-exercise-filters"><input className="input" aria-label="Поиск упражнений" placeholder="Например: плечи, жим, приседания…" value={query} onChange={e=>{setQuery(e.target.value);setShown(24)}}/><select aria-label="Инвентарь" value={equipment} onChange={e=>{setEquipment(e.target.value);setShown(24)}}><option value="">Любой инвентарь</option>{equipmentOptions.map(eq=><option key={eq} value={eq}>{equipmentLabel(eq)}</option>)}</select></div>
    <div className="catalogue-groups" aria-label="Группы мышц"><button className={!group?'selected':''} aria-pressed={!group} onClick={()=>{setGroup('');setShown(24)}}><span>Все группы</span><b>{scoped.length}</b><small>{homeOnly?'Домашний инвентарь':'Весь инвентарь'}</small></button>{GROUPS.filter(g=>counts[g.id]>0||g.id===group).map(g=><button key={g.id} aria-pressed={group===g.id} className={group===g.id?'selected':''} onClick={()=>{setGroup(g.id);setShown(24)}}><span>{g.name}</span><b>{counts[g.id]}</b><small>{g.detail}</small></button>)}</div>
    <div className="desk-exercise-layout"><section className="desk-panel catalogue-results"><div className="catalogue-result-heading"><h2>{GROUPS.find(g=>g.id===group)?.name || (browse?'Упражнения':'Мой список')}</h2><span>{filtered.length} найдено</span></div>
      {!filtered.length&&<div className="catalogue-empty"><h3>{!browse&&!favorites.length?'Ты ещё не выбрал упражнения':'Ничего не найдено'}</h3><p>{!browse&&!favorites.length?'Открой каталог, выбери движение и нажми «Добавить в мой список».':'Сбрось фильтры или попробуй другое название.'}</p><button className="btn" onClick={()=>{setBrowse(true);setHomeOnly(false);reset()}}>Открыть весь каталог</button></div>}
      <div className="desk-exercise-list">{filtered.slice(0,shown).map(ex=><button className={'desk-exercise-row '+(selected?.id===ex.id?'selected':'')} key={ex.id} data-exercise-id={ex.id} onClick={()=>choose(ex)}><Thumb ex={ex}/><span><b>{exerciseLabel(S,ex)}</b><small>{muscleLabel(ex.tg)} · {equipmentLabel(ex.eq)}</small></span>{favorites.includes(ex.id)&&<span className="catalogue-favorite" aria-label="В моём списке">✓</span>}<span aria-hidden="true">→</span></button>)}</div>
      {filtered.length>shown&&<button className="btn catalogue-more" onClick={()=>setShown(shown+24)}>Показать ещё · осталось {filtered.length-shown}</button>}
    </section><aside ref={preview} className="desk-panel desk-exercise-preview" aria-label="Карточка упражнения">{selected?<>
      <span className="neo-kicker">{GROUPS.find(g=>g.id===exerciseGroup(selected))?.name}</span><h2>{exerciseLabel(S,selected)}</h2>
      {S.desktopExerciseNames?.[selected.id]&&<p className="catalogue-original">В каталоге: {russianNames[selected.id]||selected.n}</p>}
      <div className="catalogue-tags"><span>{muscleLabel(selected.tg)}</span><span>{equipmentLabel(selected.eq)}</span></div>
      <Media key={selected.id} ex={selected}/>{!selected.gif&&<p className="desk-helper">Для этого упражнения нет анимации.</p>}
      <details className="catalogue-instructions"><summary>Как выполнять · {instructions.length} шагов</summary>{SOURCE_CONFLICTS.has(selected.id)?<p className="desk-helper">В исходной базе название и описание движения расходятся. Пошаговая инструкция скрыта, пока соответствие не проверено.</p>:<ol>{instructions.map((step,i)=><li key={i}>{step}</li>)}</ol>}</details>
      {!!selected.sm?.length&&<p className="catalogue-secondary">Также работают: {[...new Set(selected.sm.map(muscleLabel))].join(', ').toLocaleLowerCase('ru')}.</p>}
      <div className="catalogue-personal"><h3>Настроить под себя</h3><label className="desk-field">Как я называю упражнение<input className="input" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><p className="desk-helper">Это название будет на тренировке и в разговоре с напарником.</p>
      {restDefault&&<><label className="desk-field">Мой отдых между подходами, сек<input className="input" type="number" min="5" max="3600" value={rest} onChange={e=>setRest(e.target.value)} placeholder={`Автоматически: ${restDefault.seconds}`}/></label><p className="desk-helper">Автоматически: {restDefault.seconds} сек. {restDefault.reason}. Пустое поле оставляет автоматический подбор.</p></>}
      {error&&<p role="alert" className="voice-error">{error}</p>}{savedMessage&&<p role="status" className="catalogue-saved">{savedMessage}</p>}<div className="desk-exercise-actions"><button className="btn primary" disabled={busy} onClick={save}>{busy?'Сохраняю…':favorites.includes(selected.id)?'Сохранить настройки':'Добавить в мой список'}</button>{favorites.includes(selected.id)&&<button className="btn" disabled={busy} onClick={remove}>Убрать из списка</button>}</div></div>
    </>:<div className="catalogue-preview-empty"><span className="neo-kicker">Сначала посмотри движение</span><h2>Выбери упражнение слева</h2><p>Здесь появятся анимация, инструкция на русском и настройки для твоих тренировок.</p></div>}</aside></div>
    <details className="catalogue-source"><summary>Источник упражнений и перевод</summary><p>Данные и инструкции: <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">Exercises Dataset</a>, открытая база под MIT. Русские названия подготовлены для openGym. У изображений и анимаций отдельные условия источника; они уже хранятся локально после загрузки в настройках.</p></details>
  </div>
}
