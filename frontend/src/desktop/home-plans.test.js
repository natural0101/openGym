import { describe, it, expect } from 'vitest'
import { buildHomePlan } from './home-plans.js'
import { EXIDX } from '../lib/exercises.js'
describe('home plans for dumbbells and treadmill', () => {
  it('creates independent valid routines without a bench, cable or barbell', () => {
    const plan = buildHomePlan('dumbbells'), other = buildHomePlan('dumbbells')
    expect(plan.routines).toHaveLength(4)
    expect(plan.schedule.map(s => s.day)).toEqual([1, 3, 5])
    for (const r of plan.routines) {
      expect(other.routines.some(x => x.id === r.id)).toBe(false)
      expect(new Set(r.ex.map(e => e.id)).size).toBe(r.ex.length)
      for (const e of r.ex) {
        expect(EXIDX[e.id]).toBeTruthy()
        expect(['dumbbell', 'body weight'].includes(EXIDX[e.id].eq) || e.id === '3666').toBe(true)
        if (e.id === '3666') expect(e).toMatchObject({ mode: 'cardio', sets: 1, speed: 4 })
        else expect(e.weight).toBe(0)
      }
    }
    expect(buildHomePlan('unknown')).toBe(null)
  })
})
