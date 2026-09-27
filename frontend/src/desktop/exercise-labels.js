import { HOME_NAMES } from './home-names.js'

export function exerciseLabel(state, exercise) {
  if (!exercise) return ''
  return state?.desktopExerciseNames?.[exercise.id]?.trim() || HOME_NAMES[exercise.id] || exercise.n || ''
}

export function matchesPersonalExercise(state, exercise, query) {
  const normalize = value => String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const haystack = normalize([exerciseLabel(state, exercise), exercise.n, exercise.eq, exercise.bp, exercise.tg].join(' '))
  return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word))
}
