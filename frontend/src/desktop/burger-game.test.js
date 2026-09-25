import { describe, it, expect } from 'vitest'
import { reconcileBurger, rewardBurger, snapshotBurgerPlan, burgerView } from './burger-game.js'

const at = day => new Date(day + 'T12:00:00').getTime()
const state = () => ({ routines: [{ id: 'r', ex: [{ id: 'e' }] }], week: { 1: ['r'], 3: ['r'], 5: ['r'] }, dayPlan: {}, workouts: [] })
const workout = (id = 'w', done = true) => ({ id, entries: [{ sets: [{ done }] }] })
const start = () => { const s = state(); reconcileBurger(s, at('2026-09-25')); return s }

describe('desktop burger challenge', () => {
  it('starts at 100 without charging any old missed days or rewarding old history', () => {
    const s = state(); s.workouts.push(workout()); reconcileBurger(s, at('2026-09-25'))
    expect(s.desktopBurger.remaining).toBe(100); expect(s.desktopBurger.misses).toBe(0)
  })
  it('rewards a real finished session once, including unilateral sets, but not an empty finish', () => {
    const s = start()
    expect(rewardBurger(s, workout('empty', false), at('2026-09-25'))).toBe(false)
    rewardBurger(s, workout(), at('2026-09-25')); rewardBurger(s, workout(), at('2026-09-25'))
    expect(s.desktopBurger.remaining).toBe(90)
    rewardBurger(s, { id: 'side', entries: [{ sets: [{ sides: { L: { done: true }, R: { done: false } } }] }] }, at('2026-09-25'))
    expect(s.desktopBurger.remaining).toBe(80)
  })
  it('charges only closed scheduled days, including while closed, exactly once across restart', () => {
    let s = start(); reconcileBurger(s, at('2026-09-25')); expect(s.desktopBurger.remaining).toBe(100)
    reconcileBurger(s, at('2026-09-29')) // Friday + Monday, weekend is rest
    expect(s.desktopBurger.remaining).toBe(110); expect(s.desktopBurger.misses).toBe(2)
    s = JSON.parse(JSON.stringify(s)); reconcileBurger(s, at('2026-09-29'))
    expect(s.desktopBurger.remaining).toBe(110)
  })
  it('does not penalize a completed day and ignores clock rollback', () => {
    const s = start(); rewardBurger(s, workout(), at('2026-09-25'))
    reconcileBurger(s, at('2026-09-26')); expect(s.desktopBurger.remaining).toBe(90)
    reconcileBurger(s, at('2026-09-24')); reconcileBurger(s, at('2026-09-26'))
    expect(s.desktopBurger.remaining).toBe(90)
  })
  it('honors explicit rest, custom days and ignores deleted/empty routines', () => {
    const s = state(); s.dayPlan = { '2026-09-25': 'rest', '2026-09-26': 'r' }
    reconcileBurger(s, at('2026-09-25')); reconcileBurger(s, at('2026-09-27'))
    expect(s.desktopBurger.misses).toBe(1)
    const empty = state(); empty.routines = []; reconcileBurger(empty, at('2026-09-25')); reconcileBurger(empty, at('2026-09-29'))
    expect(empty.desktopBurger.misses).toBe(0)
  })
  it('settles the saved old plan before applying a new schedule', () => {
    const s = start(); reconcileBurger(s, at('2026-09-26')); s.week = {}; snapshotBurgerPlan(s)
    reconcileBurger(s, at('2026-10-03'))
    expect(s.desktopBurger.remaining).toBe(105)
  })
  it('caps growth, visibly shrinks and keeps victory after future missed days', () => {
    const s = start(); const initial = burgerView(s).scale
    rewardBurger(s, workout(), at('2026-09-25')); expect(burgerView(s).scale).toBeLessThan(initial)
    for (let i = 1; i < 10; i++) rewardBurger(s, workout('w' + i), at('2026-09-25'))
    expect(burgerView(s)).toMatchObject({ remaining: 0, won: true, scale: 0 })
    reconcileBurger(s, at('2027-01-01')); expect(s.desktopBurger.remaining).toBe(0)
    const missed = start(); reconcileBurger(missed, at('2027-01-01')); expect(missed.desktopBurger.remaining).toBe(150)
  })
})
