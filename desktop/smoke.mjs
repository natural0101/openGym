import {_electron as electron} from 'playwright'
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
const output=path.resolve('desktop/test-output');await mkdir(output,{recursive:true})
const profile=await mkdtemp(path.join(output,'release-smoke-')),errors=[],requests=[],checks=[]
let app,page
const launch=async()=>{app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor();await page.context().setOffline(true)}
try{
 await launch()
 const fresh=(await page.evaluate(()=>window.openGymDesktop.load())).state
 assert.equal(fresh.active,null);assert.deepEqual(fresh.workouts,[]);assert.deepEqual(fresh.routines,[]);assert.equal((await page.evaluate(()=>window.openGymDesktop.voiceInfo())).hasKey,false)
 assert(await page.evaluate(()=>document.fonts.ready.then(()=>document.fonts.check('600 16px Rubik','Тренировка'))))
 checks.push('Fresh profile: empty history/plans, no bundled key; offline fonts and UI')
 // Previous-day recovery is user-triggered, not a silent migration.
 await page.evaluate(async()=>{const s=(await window.openGymDesktop.load()).state;const d=new Date();d.setDate(d.getDate()-1);const date=d.toLocaleDateString('en-CA');s.active={id:'smoke-old',d:date,name:'Earlier',start:1,entries:[{id:'0289',sets:[{w:10,r:12,done:true}]}],routineIds:[]};await window.openGymDesktop.save(s)})
 await page.reload();await page.getByRole('button',{name:/Сохранить тренировку за/}).click();await page.getByRole('button',{name:'Сохранить',exact:true}).click()
 await page.waitForFunction(async()=>!(await window.openGymDesktop.load()).state.active)
 const recovered=(await page.evaluate(()=>window.openGymDesktop.load())).state;assert.equal(recovered.workouts[0].end,null);assert.equal(recovered.workouts[0].entries[0].sets[0].r,12)
 await page.getByRole('button',{name:'Настройки',exact:true}).click()
 const exportPath=path.join(profile,'export.json')
 await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath})},exportPath)
 await page.getByRole('button',{name:'Экспортировать',exact:true}).click();await page.getByText('Резервная копия сохранена',{exact:true}).waitFor()
 const exported=JSON.parse(await readFile(exportPath,'utf8'));assert.equal(exported.workouts.length,1)
 const bad=path.join(profile,'invalid.json');await writeFile(bad,'{"routines":[]}')
 await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]})},bad)
 await page.getByRole('button',{name:'Восстановить',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal((await page.evaluate(()=>window.openGymDesktop.load())).state.workouts.length,1)
 await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]})},exportPath)
 await page.getByRole('button',{name:'Восстановить',exact:true}).click();await page.locator('.center').getByRole('button',{name:'Восстановить',exact:true}).click();await page.getByText('Данные восстановлены',{exact:true}).waitFor()
 checks.push('Previous-day recovery; native export; invalid import rejected; confirmed valid restore')
 await page.getByText('Подключить Deepgram',{exact:true}).click();await page.getByLabel('API-ключ Deepgram',{exact:true}).fill('review_fake_key_never_a_real_credential');await page.getByRole('button',{name:'Сохранить ключ',exact:true}).click();await page.getByRole('button',{name:'Удалить ключ',exact:true}).click();await page.getByText('Ключ удалён.',{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.openGymDesktop.voiceInfo())).hasKey,false)
 for(const label of ['Мои упражнения','Статистика','Сегодня']){await page.getByRole('button',{name:label,exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 for(const width of [820,1366]){await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('/widget/')).setSize(width,850),width);await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 await page.getByRole('button',{name:'Развернуть меню',exact:true}).click();await page.getByRole('button',{name:'Свернуть меню',exact:true}).click()
 await app.close();await launch();assert.equal((await page.evaluate(()=>window.openGymDesktop.load())).state.workouts.length,1)
 await page.keyboard.press('Control+k');await page.getByPlaceholder('Найти раздел…').fill('История');await page.keyboard.press('Enter');await page.waitForURL('**#/history')
 checks.push('Key save/delete; routes and narrow/wide layout; restart persistence; keyboard search')
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[])
 await writeFile(path.join(output,'smoke-report.json'),JSON.stringify({passed:true,checks,errors,requests},null,2));console.log(JSON.stringify({passed:true,checks}))
}finally{await app?.close()}
