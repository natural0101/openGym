import { hasCompletedWork } from '../lib/workout-model.js'

export const BURGER_START = 100
export const BURGER_MAX = 150
export const BURGER_REWARD = 10
export const BURGER_MISS = 5

export function burgerDay(now = Date.now()) {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nextDay = day => {
  const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + 1)
  return burgerDay(d)
}
const planOf = S => {
  const ids = new Set((S.routines || []).filter(r => r.ex?.length).map(r => r.id))
  const week = Object.fromEntries(Array.from({ length: 7 }, (_, d) => [d, [].concat(S.week?.[d] || []).some(id => ids.has(id))]))
  const days = Object.fromEntries(Object.entries(S.dayPlan || {}).filter(([, id]) => id === 'rest' || ids.has(id)).map(([day, id]) => [day, id !== 'rest']))
  return { week, days }
}

// Called before each desktop mutation: close past days using the plan that was
// actually saved, then snapshot the edited plan separately. No retroactive penalties.
export function reconcileBurger(S, now = Date.now()) {
  const today = burgerDay(now)
  if (!S.desktopBurger) {
    S.desktopBurger = { version: 1, remaining: BURGER_START, startedDay: today, day: today,
      completedDays: [], rewardedIds: [], sessions: 0, misses: 0, won: false,
      plan: planOf(S), last: null }
    return true
  }
  const game = S.desktopBurger
  if (today <= game.day || game.won) return false
  while (game.day < today) {
    const scheduled = game.plan.days[game.day] ?? game.plan.week[new Date(game.day + 'T12:00:00').getDay()]
    if (scheduled && !game.completedDays.includes(game.day)) {
      game.remaining = Math.min(BURGER_MAX, game.remaining + BURGER_MISS)
      game.misses++
      game.last = { kind: 'miss', day: game.day }
    }
    game.day = nextDay(game.day)
  }
  game.completedDays = game.completedDays.filter(day => day >= today)
  return true
}

export function snapshotBurgerPlan(S) {
  if (S.desktopBurger && !S.desktopBurger.won) S.desktopBurger.plan = planOf(S)
}

// Only the real finish-session action calls this, inside the same saved transaction.
// History imports, edits and empty sessions cannot grant progress.
export function rewardBurger(S, workout, now = Date.now()) {
  reconcileBurger(S, now)
  const game = S.desktopBurger
  if (game.won || game.rewardedIds.includes(workout.id) || !workout.entries?.some(e => e.sets?.some(hasCompletedWork))) return false
  game.rewardedIds.push(workout.id)
  const day = burgerDay(now)
  if (!game.completedDays.includes(day)) game.completedDays.push(day)
  game.remaining = Math.max(0, game.remaining - BURGER_REWARD)
  game.sessions++
  game.won = game.remaining === 0
  game.last = { kind: game.won ? 'win' : 'workout', day }
  return true
}

export function burgerView(S) {
  const game = S.desktopBurger
  const remaining = game?.remaining ?? BURGER_START
  return { remaining, won: game?.won === true, sessions: game?.sessions || 0,
    misses: game?.misses || 0, last: game?.last?.kind || null,
    scale: remaining === 0 ? 0 : 0.22 + 0.68 * Math.sqrt(remaining / BURGER_START) }
}
