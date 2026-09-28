import { buildCompletedWorkout } from '../lib/finish-workout.js'
import { workoutVolume } from '../lib/history.js'

// User-triggered recovery only. Keep the original date; the end time is unknown.
export function archivePreviousWorkout(state, today) {
  const active = state.active
  if (!active || active.backfill || !/^\d{4}-\d{2}-\d{2}$/.test(active.d) || active.d >= today) throw Error('Нет незавершённой тренировки за прошлый день.')
  if (state.workouts.some(w => w.id === active.id)) throw Error('Такая тренировка уже есть в истории. Открой её для проверки.')
  const workout = buildCompletedWorkout(active, { end: null })
  if (workout.entries.length) { workout.vol = workoutVolume(workout); state.workouts.push(workout) }
  state.active = null
  state.desktopVoiceLast = null
  return workout.entries.length > 0
}
