import { describe, it, expect } from 'vitest'
import { exerciseRest } from './rest-policy.js'
import { EXDB } from '../lib/exercises-data.js'
const ex = id => EXDB.find(e => e.id === id)
describe('adjustable exercise rest defaults', () => {
  it.each([['1760', 150], ['0426', 120], ['0662', 120], ['0294', 75], ['0334', 75]])('uses movement type for %s', (id, seconds) => {
    expect(exerciseRest(ex(id), { r: 10 }).seconds).toBe(seconds)
  })
  it('does not infer effort from kilograms but responds to explicit effort and reps', () => {
    expect(exerciseRest(ex('1760'), { r: 10, w: 100 }).seconds).toBe(150)
    expect(exerciseRest(ex('1760'), { r: 5, effort: 'hard' }).seconds).toBe(210)
  })
  it('gives isolation legs shorter rest than compound legs', () => {
    expect(exerciseRest({ id: 'calf', n: 'standing calf raise', bp: 'lower legs', tg: 'calves' }).seconds).toBe(75)
  })
  it('does not start automatic rest for cardio, even with an override', () => {
    expect(exerciseRest(ex('3666'), {}, { '3666': 60 })).toBe(null)
    expect(exerciseRest(ex('0294'), { mode: 'cardio' })).toBe(null)
  })
  it('honors a valid per-exercise override and provides longer transition rest', () => {
    expect(exerciseRest(ex('1760'), {}, { '1760': 180 }).seconds).toBe(180)
    expect(exerciseRest(ex('1760'), {}, { '1760': 180 }, true).seconds).toBe(210)
    expect(exerciseRest(ex('0294'), {}, {}, true).seconds).toBe(120)
    expect(exerciseRest(ex('1760'), {}, { '1760': -10 }).seconds).toBe(150)
  })
})
