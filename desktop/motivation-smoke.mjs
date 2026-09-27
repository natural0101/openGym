import {_electron as electron} from 'playwright'
import {mkdtemp,writeFile} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const profile=await mkdtemp(path.resolve('desktop/test-output/motivation-'))
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 await page.getByText('Твой рост и подробности',{exact:true}).click();assert((await page.getByRole('region',{name:'Мой прогресс'}).innerText()).includes('Первые записи'))
 const settings=await page.evaluate(()=>window.openGymDesktop.motivationInfo());assert.equal(settings.reminder.enabled,false)
 await page.evaluate(async()=>{
   const s=(await window.openGymDesktop.load()).state
   const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
   const today=new Date(),prior=new Date();prior.setDate(prior.getDate()-1)
   const entry=r=>({id:'0313',target:{id:'0313',mode:'reps'},sets:[{w:10,r,done:true}]})
   s.workouts=[{id:'prior',d:day(prior),name:'Previous',entries:[entry(10)]}]
   s.active={id:'current',d:day(today),name:'Current',start:Date.now(),entries:[entry(12)],routineIds:[]}
   await window.openGymDesktop.save(s)
 });await page.reload();await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 await page.getByText('Твой рост и подробности',{exact:true}).click();await page.getByText('+2 повт. при 10 кг · было 10, сейчас 12',{exact:true}).waitFor()
 const before=(await page.evaluate(()=>window.openGymDesktop.load())).state
 await page.getByRole('button',{name:'Настройки',exact:true}).click()
 await page.getByLabel('Цель тренировочных дней на неделю').selectOption('2')
 await page.waitForFunction(async()=>(await window.openGymDesktop.load()).state.desktopWeeklyGoal===2)
 await page.getByLabel('Вид виджета',{exact:true}).selectOption('buddy')
 await page.waitForFunction(async()=>(await window.openGymDesktop.load()).state.desktopWidgetMode==='buddy')
 await page.getByLabel('Вид виджета',{exact:true}).selectOption('simple')
 await page.waitForFunction(async()=>(await window.openGymDesktop.load()).state.desktopWidgetMode==='simple')
 const after=(await page.evaluate(()=>window.openGymDesktop.load())).state
 assert.deepEqual(after.active,before.active);assert.deepEqual(after.workouts,before.workouts)
 await page.getByRole('button',{name:'Сегодня',exact:true}).click()
 await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click()
 await page.getByText('Хорошая работа. Тренировка сохранена.',{exact:true}).waitFor()
 assert.equal((await page.evaluate(()=>window.openGymDesktop.load())).state.active,null)
 assert.deepEqual(errors,[])
 const report={passed:true,profile,checks:['First record baseline','Exact +2 rep comparison','Weekly goal/settings persistence','Settings preserve training','Post-finish praise'],errors}
 await writeFile('desktop/test-output/motivation-smoke-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await app.close()}
