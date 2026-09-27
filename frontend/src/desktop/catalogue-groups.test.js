import { describe, it, expect } from 'vitest'
import { EXDB } from '../lib/exercises-data.js'
import { CATALOGUE } from '../lib/exercises.js'
import names from '../exercise-names/ru.js'
import instructions from '../instr/ru.js'
import { GROUPS, exerciseGroup, EQUIPMENT_RU, MUSCLES_RU, isHomeExercise } from './catalogue-groups.js'
import { exerciseLabel, matchesPersonalExercise } from './exercise-labels.js'
it('covers every upstream id with a Russian name, Russian instructions and a known group',()=>{
 expect(Object.keys(names).sort()).toEqual(EXDB.map(e=>e.id).sort())
 for(const ex of EXDB){expect(names[ex.id]).toMatch(/[А-Яа-яЁё]/);expect(names[ex.id]).not.toMatch(/[A-Za-z]/);expect(instructions[ex.id]?.length).toBeGreaterThan(0);expect(GROUPS.some(g=>g.id===exerciseGroup(ex))).toBe(true);expect(EQUIPMENT_RU[ex.eq]).toBeTruthy();expect(MUSCLES_RU[ex.tg]).toBeTruthy()}
})
it('groups primary muscle instead of putting all legs and arms in one bucket',()=>{
 expect(exerciseGroup({bp:'upper legs',tg:'glutes'})).toBe('glutes')
 expect(exerciseGroup({bp:'upper legs',tg:'quads'})).toBe('legs')
 expect(exerciseGroup({bp:'upper arms',tg:'triceps'})).toBe('arms')
 expect(exerciseGroup({bp:'waist',tg:'abs'})).toBe('core')
})
it('searches Russian muscle, equipment, translated and personal names',()=>{
 const ex=EXDB.find(e=>e.id==='0426');expect(matchesPersonalExercise({},ex,'плечи')).toBe(true);expect(matchesPersonalExercise({},ex,'гантели')).toBe(true)
 expect(matchesPersonalExercise({},ex,ex.n)).toBe(true)
 expect(exerciseLabel({desktopExerciseNames:{'0426':'Мой жим'}},ex)).toBe('Мой жим')
 expect(isHomeExercise(ex)).toBe(true);expect(isHomeExercise({id:'custom',eq:'cable'})).toBe(false)
})

it('classifies every runtime built-in without the custom fallback group',()=>{for(const ex of CATALOGUE)expect(exerciseGroup(ex)).not.toBe('other')})
