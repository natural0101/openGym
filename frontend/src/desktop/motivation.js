// Calendar goals count completed training days, never rest days or empty sessions.
const localDay = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const done = entry => entry.sets.filter(row => row.done)
const hasSets = workout => workout.entries.some(entry => done(entry).length)
const approximate = entry => /приблизительн|в среднем|примерно/i.test(entry.note || '')
const exactStrength = entry => approximate(entry) ? [] : done(entry).filter(r => !r.approximate && !r.warmup && r.phase !== 'warmup' && !r.sides && !r.drops?.length && !r.clusters?.length && (r.mode == null || r.mode === 'reps') && r.sec == null && r.min == null && Number.isFinite(r.w) && Number.isFinite(r.r))
export function motivation(S, now = new Date()) {
  const today = localDay(now), monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - (monday.getDay()+6)%7)
  const start = localDay(monday), weekGoal = Math.max(1, Math.min(7, Math.round(Number(S.desktopWeeklyGoal) || 3)))
  const completed = S.workouts.filter(w => w.d <= today && hasSets(w))
  const weekDone = new Set(completed.filter(w => w.d >= start).map(w => w.d)).size
  const sessions = [...completed.filter(w => w.d === today), ...(S.active?.d === today && hasSets(S.active) ? [S.active] : [])]
  const entries = sessions.flatMap(w => w.entries).filter(e => done(e).length)
  const todaySets = entries.reduce((n,e) => n + done(e).length,0), todayExercises = new Set(entries.map(e=>e.id)).size
  const growth = []
  for (const id of new Set(entries.map(e=>e.id))) {
    const current = entries.filter(e=>e.id===id).flatMap(exactStrength)
    const previous = completed.filter(w => w.d < today && w.entries.some(e=>e.id===id && done(e).length)).sort((a,b)=>b.d.localeCompare(a.d) || (b.start||0)-(a.start||0))[0]
    const prior = previous?.entries.filter(e=>e.id===id).flatMap(exactStrength) || []
    if (!current.length || !prior.length) continue
    // Prefer a comparable repetition gain at exactly the same load.
    const repGains = current.map(r=>{const peers=prior.filter(p=>p.w===r.w);const best=peers.length?Math.max(...peers.map(p=>p.r)):null;return best!=null && r.r>best ? {exerciseId:id,kind:'reps',delta:r.r-best,weight:r.w,previous:best,current:r.r,date:previous.d}:null}).filter(Boolean).sort((a,b)=>b.delta-a.delta)
    if(repGains.length){growth.push(repGains[0]);continue}
    // A heavier set is progress only when repetitions are at least maintained.
    const previousBest = prior.reduce((a,b)=>b.w>a.w || (b.w===a.w && b.r>a.r)?b:a)
    const heavier=current.filter(r=>r.w>previousBest.w && r.r>=previousBest.r).sort((a,b)=>b.w-a.w)[0]
    if(heavier)growth.push({exerciseId:id,kind:'weight',delta:heavier.w-previousBest.w,previous:previousBest.w,current:heavier.w,reps:heavier.r,date:previous.d})
  }
  const finishedToday=completed.some(w=>w.d===today)
  const headline=todaySets ? finishedToday && !S.active ? 'Хорошая работа. Тренировка сохранена.' : 'Хорошая работа — подходы уже в дневнике.' : weekDone>=weekGoal ? 'Цель недели выполнена. Отдых тоже часть плана.' : 'Можно начать с одного упражнения.'
  return {today,weekGoal,weekDone,todaySets,todayExercises,finishedToday,headline,growth,hasHistory:completed.some(w=>w.d<today),hasApproximate:entries.some(e=>approximate(e)||done(e).some(r=>r.approximate))}
}
