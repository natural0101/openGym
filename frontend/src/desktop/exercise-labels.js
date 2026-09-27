import { HOME_NAMES } from './home-names.js'
import russianNames from '../exercise-names/ru.js'
import { GROUPS, exerciseGroup, muscleLabel, equipmentLabel } from './catalogue-groups.js'

export function exerciseLabel(state, exercise) {
  if (!exercise) return ''
  const personal = state?.desktopExerciseNames?.[exercise.id]
  return (typeof personal === 'string' && personal.trim()) || russianNames[exercise.id] || HOME_NAMES[exercise.id] || exercise.n || ''
}

export function matchesPersonalExercise(state, exercise, query) {
  const normalize = value => String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const haystack = normalize([exerciseLabel(state, exercise), russianNames[exercise.id], exercise.n, equipmentLabel(exercise.eq), muscleLabel(exercise.tg), GROUPS.find(g=>g.id===exerciseGroup(exercise))?.name, exercise.eq, exercise.bp, exercise.tg].join(' '))
  return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word))
}
