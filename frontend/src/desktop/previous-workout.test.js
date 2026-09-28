import {it,expect} from 'vitest'
import {archivePreviousWorkout} from './previous-workout.js'
const state=()=>({workouts:[],active:{id:'old',d:'2026-09-27',start:123,name:'Yesterday',entries:[{id:'0289',sets:[{w:10,r:12,done:true},{w:10,r:12,done:false}]}]},desktopBurger:{remaining:80}})
it('archives on the original date without invented duration or rewards, then allows a new session',()=>{
 const s=state(),sets=structuredClone(s.active.entries[0].sets)
 expect(archivePreviousWorkout(s,'2026-09-28')).toBe(true)
 expect(s.active).toBe(null);expect(s.workouts[0].d).toBe('2026-09-27');expect(s.workouts[0].end).toBe(null)
 expect(s.workouts[0].entries[0].sets).toEqual(sets);expect(s.desktopBurger.remaining).toBe(80)
 expect(()=>archivePreviousWorkout(s,'2026-09-28')).toThrow();expect(s.workouts).toHaveLength(1)
})
it('does not discard todays workout, a backfill, or a conflicting history record',()=>{
 for(const change of [s=>s.active.d='2026-09-28',s=>s.active.backfill=true,s=>s.workouts.push({id:'old'})]){const s=state();change(s);const before=structuredClone(s);expect(()=>archivePreviousWorkout(s,'2026-09-28')).toThrow();expect(s).toEqual(before)}
})
it('an empty old session does not create fabricated training history',()=>{const s=state();s.active.entries=[];expect(archivePreviousWorkout(s,'2026-09-28')).toBe(false);expect(s.workouts).toEqual([])})
