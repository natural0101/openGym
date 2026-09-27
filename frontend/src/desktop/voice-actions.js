import { EXDB } from '../lib/exercises-data.js'
import { exerciseLabel } from './exercise-labels.js'
import { buildCompletedWorkout } from '../lib/finish-workout.js'
import { workoutVolume, bestWeightForEntry } from '../lib/history.js'
import { beatsWeight } from '../lib/exercises.js'
import { rewardBurger, burgerDay } from './burger-game.js'
import { exerciseRest, REST_POLICY } from './rest-policy.js'

const clean = value => String(value || '').toLowerCase().replace(/ё/g, 'е').trim()
const label = (S, ex) => exerciseLabel(S, ex)
const catalogue = S => [...EXDB, ...(S.customEx || [])]
const aliases = { '3666': 'беговая беговой дорожка дорожке дорожку дорожки ходьба treadmill walking', '0294': 'бицепс бицепса сгибание сгибания рук гантели гантелями', '1760': 'присед приседания гоблет', '0426': 'жим стоя плечи гантели', '0334': 'махи разводка стороны гантели', '0662': 'отжимания от пола', '3211': 'отжимания с колен' }
const number = (value, name, min, max, integer = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw Error(`Уточни ${name}: допустимо ${min}–${max}.`)
  return value
}
export function voiceContext(S) {
  const names = new Map(catalogue(S).map(e => [e.id, label(S, e)]))
  const summary = w => w ? { id: w.id, name: w.name, date: w.d, entries: w.entries.map((e, i) => ({ entry_index: i, exercise_id: e.id, name: names.get(e.id), sets: e.sets.map((s, j) => ({ set_index: j, weight: s.w, reps: s.r, minutes: s.min, speed: s.speed, done: !!s.done })) })) } : null
  const activeIds = new Set(S.active?.entries.map(e => e.id) || [])
  const recentExerciseHistory = S.workouts.slice().reverse().filter(w => w.entries.some(e => activeIds.has(e.id))).slice(0, 4).map(w => summary({ ...w, entries: w.entries.filter(e => activeIds.has(e.id)).map(e => ({ ...e, sets: e.sets.filter(s => s.done).slice(-8) })).slice(-8) }))
  return { ok: true, today: burgerDay(), unit: S.unit, weightConvention: 'Вес одной гантели', active: summary(S.active), lastWorkout: summary(S.workouts.at(-1)), defaultRestSeconds: S.restSec, restPolicy: REST_POLICY, restOverrides: S.desktopRestOverrides || {}, personalExercises: catalogue(S).filter(e => (S.desktopFavorites || []).includes(e.id)).slice(0, 60).map(e => ({ exercise_id: e.id, name: label(S, e) })), recentExerciseHistory }
}
export function readVoiceAction(S, args) {
  if (args.action === 'context') return voiceContext(S)
  if (args.action !== 'search') return null
  const query = clean(args.query); if (query.length < 2 || query.length > 100) throw Error('Уточни название упражнения.')
  const terms = query.split(/\s+/)
  const results = catalogue(S).map(ex => ({ ex, text: clean(`${label(S, ex)} ${ex.n || ''} ${aliases[ex.id] || ''}`) })).filter(({ text }) => terms.every(t => text.includes(t))).sort((a, b) => Number((S.desktopFavorites || []).includes(b.ex.id)) - Number((S.desktopFavorites || []).includes(a.ex.id)))
  return { ok: true, matches: results.slice(0, 12).map(({ ex }) => ({ exercise_id: ex.id, name: label(S, ex), originalName: ex.n, equipment: ex.eq })), total: results.length, hint: results.length ? 'При неоднозначности уточни упражнение, не выбирай случайно.' : 'Попробуй английский эквивалент или более короткое название.' }
}
const makeActive = (S, name, now) => ({ id: crypto.randomUUID(), d: burgerDay(now), name: String(name || 'Тренировка с напарником').slice(0, 100), start: now, bw: S.bodyweight.at(-1)?.w ?? null, entries: [], routineIds: [] })
const findRow = (S, args) => {
  const a = S.active; if (!a) throw Error('Нет активной тренировки. Историю голосом не меняю.')
  let ei = args.entry_index, si = args.set_index
  if (ei == null && si == null) {
    for (let i = 0; i < a.entries.length; i++) { const j = a.entries[i].sets.findIndex(s => s.voiceId === S.desktopVoiceLast); if (S.desktopVoiceLast && j >= 0) { ei = i; si = j; break } }
  }
  number(ei, 'номер упражнения', 0, a.entries.length - 1, true)
  number(si, 'номер подхода', 0, a.entries[ei].sets.length - 1, true)
  const row = a.entries[ei].sets[si]
  if (!row.done || row.sides || row.drops?.length || row.clusters?.length) throw Error('Этот подход требует редактирования в экране тренировки.')
  return { entry: a.entries[ei], row, ei, si }
}
function setValues(args, old = null) {
  if (args.minutes != null || old?.mode === 'cardio') {
    if (args.weight != null || args.reps != null) throw Error('Для дорожки назови длительность и, при желании, скорость.')
    const row = { ...(old || {}), mode: 'cardio', min: number(args.minutes ?? old?.min, 'длительность в минутах', 0.1, 600), done: true }
    if (args.speed != null) row.speed = number(args.speed, 'скорость в км/ч', 0, 40)
    return row
  }
  return { ...(old || {}), w: number(args.weight ?? old?.w, 'вес', 0, 1000), r: number(args.reps ?? old?.r, 'повторы', 1, 1000, true), done: true }
}
// Mutates a store draft only. The caller must await durable storage before acknowledging.
export function applyVoiceAction(S, args, callId, now = Date.now()) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw Error('Не удалось разобрать команду.')
  if (!callId || callId.length > 200) throw Error('Команда без идентификатора.')
  const prior = S.desktopVoiceReceipts?.find(r => r.id === callId)
  if (prior) { const { effect, ...result } = prior.result; return { ...result, duplicate: true } }
  let result
  if (['rest', 'stop_rest', 'stop_listening'].includes(args.action)) {
    result = { ok: true, effect: args.action, ...(args.action === 'rest' ? { seconds: number(args.seconds ?? S.restSec, 'отдых в секундах', 5, 3600, true) } : {}) }
  } else if (args.action === 'start') {
    if (S.active) throw Error('Тренировка уже начата. Продолжай её или сначала закончи.')
    S.active = makeActive(S, args.name, now); result = { ok: true, message: 'Тренировка начата.', workoutId: S.active.id }
  } else if (args.action === 'log_set') {
    const ex = catalogue(S).find(e => e.id === args.exercise_id)
    if (!ex) throw Error('Сначала найди упражнение через search.')
    const row = { ...setValues(args), voiceId: callId }
    if (args.effort != null) {
      if (!['easy', 'moderate', 'hard'].includes(args.effort)) throw Error('Уточни, насколько тяжёлым был подход.')
      row.effort = args.effort
    }
    if (!S.active) S.active = makeActive(S, args.name, now)
    if (S.active.d !== burgerDay(now) || S.active.backfill) throw Error('Открыта тренировка за другую дату. Сначала заверши или отредактируй её вручную.')
    let entry = S.active.entries.find(e => e.id === ex.id)
    if (!entry) { entry = { id: ex.id, target: { id: ex.id, mode: row.mode || 'reps', sets: 1, restSec: S.restSec }, sets: [] }; S.active.entries.push(entry) }
    const empty = entry.sets.findIndex(s => !s.done && s.phase !== 'warmup' && !s.sides && !s.drops?.length && !s.clusters?.length)
    if (empty >= 0) entry.sets[empty] = { ...entry.sets[empty], ...row }
    else entry.sets.push(row)
    S.desktopVoiceLast = callId
    result = { ok: true, message: 'Подход записан.', exercise: label(S, ex), entry_index: S.active.entries.indexOf(entry), set_index: empty >= 0 ? empty : entry.sets.length - 1, set: row, unit: S.unit, ...exerciseRest(ex, row, S.desktopRestOverrides) }
  } else if (args.action === 'finish_exercise') {
    if (!S.active) throw Error('Нет активной тренировки.')
    const entry = args.exercise_id ? S.active.entries.find(e => e.id === args.exercise_id) : S.active.entries.find(e => e.sets.some(s => s.voiceId === S.desktopVoiceLast)) || S.active.entries.at(-1)
    const row = entry?.sets.filter(s => s.done).at(-1)
    const ex = entry && catalogue(S).find(e => e.id === entry.id)
    if (!row || !ex) throw Error('Сначала запиши выполненный подход этого упражнения.')
    result = { ok: true, message: 'Упражнение закончено. Тренировка продолжается.', exercise: label(S, ex), ...exerciseRest(ex, row, S.desktopRestOverrides, true) }
  } else if (args.action === 'correct_set') {
    if (args.weight == null && args.reps == null && args.minutes == null && args.speed == null) throw Error('Назови, что исправить в подходе.')
    const { entry, row, ei, si } = findRow(S, args)
    entry.sets[si] = setValues(args, row)
    result = { ok: true, message: 'Подход исправлен.', entry_index: ei, set_index: si, set: entry.sets[si], unit: S.unit }
  } else if (args.action === 'undo_set') {
    const { entry, ei, si } = findRow(S, args); entry.sets.splice(si, 1)
    if (!entry.sets.length) S.active.entries.splice(ei, 1)
    S.desktopVoiceLast = null
    result = { ok: true, message: 'Подход удалён из текущей тренировки.' }
  } else if (args.action === 'finish') {
    if (!S.active) throw Error('Нет активной тренировки. Повторная запись не создана.')
    if (S.active.backfill || S.active.d !== burgerDay(now)) throw Error('Тренировку за другую дату заверши на её экране.')
    const workout = buildCompletedWorkout(S.active, { end: now })
    if (!workout.entries.length) throw Error('В тренировке нет выполненных подходов.')
    workout.vol = workoutVolume(workout)
    S.exWeights ||= {}
    for (const entry of workout.entries) {
      const weight = bestWeightForEntry(entry)
      if (!entry.noProg && weight > 0 && beatsWeight(entry.id, weight, S.exWeights[entry.id]?.w || 0)) S.exWeights[entry.id] = { w: weight, d: workout.d }
    }
    S.workouts.push(workout); rewardBurger(S, workout, now); S.active = null; S.desktopVoiceLast = null
    result = { ok: true, message: 'Тренировка сохранена в журнале.', workoutId: workout.id, effect: 'stop_rest' }
  } else throw Error('Неизвестная команда.')
  result.saved = true
  S.desktopVoiceReceipts = [...(S.desktopVoiceReceipts || []), { id: callId, result }].slice(-500)
  return result
}
