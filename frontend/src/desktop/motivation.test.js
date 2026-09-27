import {it,expect} from 'vitest'
import {motivation} from './motivation.js'
const entry=(w,r,extra={})=>({id:'press',sets:[{w,r,done:true}],...extra})
const workout=(d,entries=[entry(10,10)])=>({d,entries})
const now=new Date(2026,8,27,15)
const state=(extra={})=>({workouts:[],active:workout('2026-09-27'),...extra})
it('counts completed days once, ignores empty sessions and active for weekly completion',()=>{
 const result=motivation(state({workouts:[workout('2026-09-21'),workout('2026-09-21'),workout('2026-09-22',[]),workout('2026-09-20')]}),now)
 expect(result.weekDone).toBe(1);expect(result.todaySets).toBe(1)
})
it('compares same weight against the most recent previous exercise session',()=>{
 const result=motivation(state({active:workout('2026-09-27',[entry(10,12)]),workouts:[workout('2026-09-26'),workout('2026-09-21',[entry(10,5)])]}),now)
 expect(result.growth[0]).toMatchObject({kind:'reps',delta:2,date:'2026-09-26'})
})
it('does not infer growth from approximate records, warmups or reduced reps at higher weight',()=>{
 for(const active of [workout('2026-09-27',[entry(10,12,{note:'в среднем 12'})]),workout('2026-09-27',[entry(12,8)]),workout('2026-09-27',[{id:'press',sets:[{w:20,r:12,done:true,warmup:true}]}])])expect(motivation(state({active,workouts:[workout('2026-09-26')]}),now).growth).toEqual([])
})
it('shows weight growth when reps are maintained and keeps rest days outside goal',()=>{
 const result=motivation(state({active:workout('2026-09-27',[entry(12,10)]),desktopWeeklyGoal:2,workouts:[workout('2026-09-24'),workout('2026-09-26')]}),now)
 expect(result.growth[0]).toMatchObject({kind:'weight',delta:2});expect(result.weekDone).toBe(2)
})
it('starts a new calendar week locally and does not invent a comparison for first entry',()=>{
 expect(motivation(state(),now).growth).toEqual([])
 expect(motivation(state({workouts:[workout('2026-09-27')]}),new Date(2026,8,28,0,1)).weekDone).toBe(0)
})
