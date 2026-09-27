import { describe, it, expect } from 'vitest'
import { applyVoiceAction, readVoiceAction } from './voice-actions.js'
const now = new Date('2026-09-27T12:00:00').getTime()
const fresh = () => ({ unit: 'kg', restSec: 75, bodyweight: [], customEx: [], workouts: [], routines: [], week: {}, dayPlan: {}, active: null })
const log = { action: 'log_set', exercise_id: '0294', weight: 5, reps: 10 }
describe('voice workout transactions', () => {
  it('logs one set without fabricating other values and persists its receipt', () => {
    const s = fresh(); const result = applyVoiceAction(s, log, 'one', now)
    expect(result.saved).toBe(true); expect(s.active.entries[0].sets).toEqual([{ w: 5, r: 10, done: true, voiceId: 'one' }])
    expect(s.workouts).toEqual([])
  })
  it('rejects unknown exercises, missing weights and invalid repetitions', () => {
    for (const args of [{ ...log, exercise_id: 'unknown' }, { ...log, weight: undefined }, { ...log, reps: -1 }, { ...log, reps: 2.5 }, { ...log, weight: '5' }]) {
      const s = fresh(); expect(() => applyVoiceAction(s, args, 'bad', now)).toThrow(); expect(s.active).toBe(null)
    }
  })
  it('replayed IDs cannot duplicate sets, even after serializing the state', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now)
    const restored = JSON.parse(JSON.stringify(s)); expect(applyVoiceAction(restored, log, 'one', now).duplicate).toBe(true)
    expect(restored.active.entries[0].sets).toHaveLength(1)
  })
  it('fills an unchecked planned set without adding a duplicate prescription', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now)
    s.active.entries[0].sets.push({ w: 8, r: 12, done: false })
    applyVoiceAction(s, { ...log, weight: 6 }, 'two', now)
    expect(s.active.entries[0].sets).toHaveLength(2); expect(s.active.entries[0].sets[1].w).toBe(6)
  })
  it('corrects and undoes the last voice set without changing earlier sets', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now); applyVoiceAction(s, log, 'two', now)
    applyVoiceAction(s, { action: 'correct_set', reps: 12 }, 'edit', now)
    expect(s.active.entries[0].sets.map(x => x.r)).toEqual([10, 12])
    applyVoiceAction(s, { action: 'undo_set' }, 'undo', now)
    expect(s.active.entries[0].sets.map(x => x.voiceId)).toEqual(['one'])
  })
  it('rejects ambiguous corrections and edits to complex sets', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now)
    expect(() => applyVoiceAction(s, { action: 'correct_set' }, 'bad', now)).toThrow()
    s.active.entries[0].sets[0].sides = {}; expect(() => applyVoiceAction(s, { action: 'undo_set' }, 'bad', now)).toThrow()
  })
  it('records and corrects treadmill duration and speed', () => {
    const s = fresh(); applyVoiceAction(s, { action: 'log_set', exercise_id: '3666', minutes: 10, speed: 4 }, 'walk', now)
    applyVoiceAction(s, { action: 'correct_set', minutes: 12 }, 'edit', now)
    expect(s.active.entries[0].sets[0]).toMatchObject({ min: 12, speed: 4, done: true })
  })
  it('finishes into history and rewards Burger exactly once', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now)
    applyVoiceAction(s, { action: 'finish' }, 'finish', now + 60000)
    expect(s.active).toBe(null); expect(s.workouts).toHaveLength(1); expect(s.workouts[0].vol).toBe(50)
    expect(s.desktopBurger.remaining).toBe(90)
    applyVoiceAction(s, { action: 'finish' }, 'finish', now + 60000)
    expect(s.workouts).toHaveLength(1); expect(s.desktopBurger.sessions).toBe(1)
    expect(() => applyVoiceAction(s, { action: 'finish' }, 'other', now)).toThrow()
  })
  it('does not finish empty sessions or overwrite an existing active workout', () => {
    const s = fresh(); applyVoiceAction(s, { action: 'start' }, 'start', now)
    expect(() => applyVoiceAction(s, { action: 'finish' }, 'end', now)).toThrow()
    expect(() => applyVoiceAction(s, { action: 'start' }, 'start2', now)).toThrow()
  })
  it('rejects changes and completion for a backfilled session', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now); s.active.backfill = { durationMin: 30 }
    expect(() => applyVoiceAction(s, log, 'two', now)).toThrow()
    expect(() => applyVoiceAction(s, { action: 'finish' }, 'end', now)).toThrow()
  })
  it('searches Russian and English names and reads actual context', () => {
    const s = fresh(); expect(readVoiceAction(s, { action: 'search', query: 'дорожке' }).matches.some(e => e.exercise_id === '3666')).toBe(true)
    expect(readVoiceAction(s, { action: 'search', query: 'dumbbell biceps curl' }).matches.some(e => e.exercise_id === '0294')).toBe(true)
    applyVoiceAction(s, log, 'one', now); expect(readVoiceAction(s, { action: 'context' }).active.entries[0].sets[0].weight).toBe(5)
  })
  it('rest control neither adds workouts nor rewards Burger', () => {
    const s = fresh(); expect(applyVoiceAction(s, { action: 'rest', seconds: 60 }, 'rest', now)).toMatchObject({ effect: 'rest', seconds: 60 })
    expect(s.workouts).toEqual([]); expect(s.desktopBurger).toBeUndefined()
  })
  it('automatically rests after a new set, but never restarts on duplicate or correction', () => {
    const s = fresh()
    expect(applyVoiceAction(s, log, 'one', now)).toMatchObject({ effect: 'rest', seconds: 75 })
    expect(applyVoiceAction(s, log, 'one', now).effect).toBeUndefined()
    expect(applyVoiceAction(s, { action: 'correct_set', reps: 12 }, 'edit', now).effect).toBeUndefined()
    const cardio = applyVoiceAction(s, { action: 'log_set', exercise_id: '3666', minutes: 10 }, 'walk', now)
    expect(cardio.effect).toBeUndefined()
  })
  it('uses a personal interval and finishes only the exercise, not the workout', () => {
    const s = fresh(); s.desktopRestOverrides = { '0294': 100 }
    expect(applyVoiceAction(s, log, 'one', now).seconds).toBe(100)
    expect(applyVoiceAction(s, { action: 'finish_exercise' }, 'end-ex', now)).toMatchObject({ effect: 'rest', seconds: 130 })
    expect(s.active.entries).toHaveLength(1); expect(s.workouts).toHaveLength(0)
  })
  it('provides bounded actual history only for exercises in the current workout', () => {
    const s = fresh(); applyVoiceAction(s, log, 'one', now)
    s.workouts = Array.from({ length: 6 }, (_, i) => ({ id: String(i), d: '2026-09-20', entries: [{ id: '0294', sets: [{ w: 4, r: 10, done: true }] }, { id: '1760', sets: [{ w: 20, r: 5, done: true }] }] }))
    const context = readVoiceAction(s, { action: 'context' })
    expect(context.recentExerciseHistory).toHaveLength(4)
    expect(context.recentExerciseHistory[0].entries).toHaveLength(1)
    expect(context.recentExerciseHistory[0].entries[0].sets[0].weight).toBe(4)
  })
})

it('finds and records the personal exercise name without changing its identity', () => {
 const s=fresh();s.desktopExerciseNames={'0426':'Мой жим вверх'};s.desktopFavorites=['0426'];
 expect(readVoiceAction(s,{action:'search',query:'мой жим вверх'}).matches[0]).toMatchObject({exercise_id:'0426',name:'Мой жим вверх'});
 expect(applyVoiceAction(s,{action:'log_set',exercise_id:'0426',weight:10,reps:10},'personal',now).exercise).toBe('Мой жим вверх');
 expect(s.active.entries[0].id).toBe('0426');
});

it('does not consume timed prescriptions or legacy warmups when recording strength', () => {
  const s = fresh(); applyVoiceAction(s, log, 'first', now)
  const timed = { mode: 'time', sec: 45, done: false }
  const warmup = { w: 2, r: 12, warmup: true, done: false }
  s.active.entries[0].sets.push(timed, warmup)
  const result = applyVoiceAction(s, log, 'next', now)
  expect(result.set_index).toBe(3)
  expect(s.active.entries[0].sets[1]).toEqual(timed)
  expect(s.active.entries[0].sets[2]).toEqual(warmup)
  expect(s.active.entries[0].sets[3]).toEqual({ w: 5, r: 10, done: true, voiceId: 'next' })
})
it('creates a reps entry instead of inheriting an existing timed target', () => {
  const s = fresh(); applyVoiceAction(s, { action: 'start' }, 'start', now)
  s.active.entries.push({ id: '0294', target: { mode: 'time' }, sets: [{ sec: 30, done: false }] })
  const result = applyVoiceAction(s, log, 'next', now)
  expect(result.entry_index).toBe(1)
  expect(s.active.entries[1].target.mode).toBe('reps')
  expect(s.active.entries[1].sets[0].sec).toBeUndefined()
})
it('restores the last voice pointer in call order across exercises and repeated undo', () => {
  const s = fresh(); applyVoiceAction(s, log, 'a', now)
  applyVoiceAction(s, { ...log, exercise_id: '0426' }, 'b', now)
  applyVoiceAction(s, log, 'c', now)
  applyVoiceAction(s, { action: 'undo_set' }, 'undo-c', now)
  expect(s.desktopVoiceLast).toBe('b')
  applyVoiceAction(s, { action: 'correct_set', reps: 11 }, 'edit-b', now)
  expect(s.active.entries[1].sets[0].r).toBe(11)
  applyVoiceAction(s, { action: 'undo_set' }, 'undo-b', now)
  expect(s.desktopVoiceLast).toBe('a')
  applyVoiceAction(s, { action: 'undo_set' }, 'undo-a', now)
  expect(s.desktopVoiceLast).toBeNull()
})
it('rejects incompatible correction fields atomically and accepts effort corrections', () => {
  const s = fresh(); applyVoiceAction(s, log, 'a', now)
  const before = structuredClone(s)
  for (const fields of [{ speed: 4 }, { minutes: 10 }, { effort: 'impossible' }, { weight: 8, speed: 4 }]) {
    expect(() => applyVoiceAction(s, { action: 'correct_set', ...fields }, 'bad', now)).toThrow()
    expect(s).toEqual(before)
  }
  const corrected = applyVoiceAction(s, { action: 'correct_set', effort: 'hard' }, 'edit', now)
  expect(corrected.set).toMatchObject({ w: 5, r: 10, effort: 'hard' })
  expect(corrected.effect).toBeUndefined()
  applyVoiceAction(s, { action: 'log_set', exercise_id: '3666', minutes: 10 }, 'walk', now)
  const cardioBefore = structuredClone(s)
  expect(() => applyVoiceAction(s, { action: 'correct_set', weight: 2 }, 'bad-cardio', now)).toThrow()
  expect(s).toEqual(cardioBefore)
  expect(applyVoiceAction(s, { action: 'correct_set', speed: 5 }, 'speed', now).set).toMatchObject({ min: 10, speed: 5 })
})
it('rejects timed-row corrections with an actionable message', () => {
  const s = fresh(); applyVoiceAction(s, log, 'a', now)
  s.active.entries[0].sets[0] = { mode: 'time', sec: 30, done: true, voiceId: 'a' }
  const before = structuredClone(s)
  expect(() => applyVoiceAction(s, { action: 'correct_set', reps: 10 }, 'bad', now)).toThrow(/на время.*экране/)
  expect(s).toEqual(before)
})
