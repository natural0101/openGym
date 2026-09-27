import { describe, it, expect } from 'vitest'
import { exerciseLabel, matchesPersonalExercise } from './exercise-labels.js'
describe('personal exercise names', () => {
  const ex = { id: '0294', n: 'dumbbell curl', eq: 'dumbbell', bp: 'upper arms' }
  it('uses personal names without changing the original catalogue identity', () => {
    const state = { desktopExerciseNames: { '0294': '  Мои сгибания  ' } }
    expect(exerciseLabel(state, ex)).toBe('Мои сгибания')
    expect(ex.n).toBe('dumbbell curl')
    expect(matchesPersonalExercise(state, ex, 'мои сгибания')).toBe(true)
    expect(matchesPersonalExercise(state, ex, 'dumbbell curl')).toBe(true)
  })
  it('supports old profiles and Russian ё search', () => {
    expect(exerciseLabel({}, ex)).toBe('Сгибание рук с гантелями')
    expect(exerciseLabel({}, { id: 'custom', n: 'Мой жим' })).toBe('Мой жим')
    expect(matchesPersonalExercise({ desktopExerciseNames: { '0294': 'Жим лёжа' } }, ex, 'жим лежа')).toBe(true)
  })
})
