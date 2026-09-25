import { _electron as electron } from 'playwright'
import { readFile,writeFile,mkdtemp,mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { burgerDay } from '../frontend/src/desktop/burger-game.js'
const output=path.resolve('desktop/test-output');await mkdir(output,{recursive:true})
const smoke=JSON.parse(await readFile(path.join(output,'smoke-report.json'),'utf8'))
const source=JSON.parse(await readFile(path.join(smoke.profile,'training.json'),'utf8'))
const date=new Date();date.setDate(date.getDate()-1);const yesterday=burgerDay(date)
for(const scenario of ['miss','win']){
 const profile=await mkdtemp(path.join(output,'burger-'+scenario+'-'));const s=structuredClone(source)
 s.desktopBurger={version:1,remaining:scenario==='win'?0:100,startedDay:yesterday,day:yesterday,completedDays:[],rewardedIds:[],sessions:scenario==='win'?10:0,misses:0,won:scenario==='win',plan:{week:{},days:{[yesterday]:true}},last:null}
 s.active=null;s.desktopBuddy='burger';await writeFile(path.join(profile,'training.json'),JSON.stringify(s));await writeFile(path.join(profile,'widget-preferences.json'),JSON.stringify({visible:true}))
 const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
 try{
  const main=await app.firstWindow();await main.getByRole('heading',{name:'Домашние тренировки',exact:true}).waitFor();await main.locator('.desk-save.saved').waitFor()
  let widget=app.windows().find(w=>w!==main);if(!widget)widget=await app.waitForEvent('window');await widget.waitForURL('**/widget/index.html')
  await widget.waitForFunction(()=>document.querySelector('.widget').dataset.desktop==='true')
  const expected=scenario==='win'?0:105;const saved=JSON.parse(await readFile(path.join(profile,'training.json'),'utf8'));assert.equal(saved.desktopBurger.remaining,expected)
  await widget.waitForFunction(expected=>document.querySelector('#value').textContent===(expected===0?'Победа!':expected+'%'),expected)
  if(scenario==='win'){assert.equal(await widget.locator('#victory').isVisible(),true);await widget.waitForFunction(()=>getComputedStyle(document.querySelector('#mascot')).scale==='0')}
  else assert(Number(await widget.locator('#mascot').evaluate(el=>el.style.getPropertyValue('--burger-scale')))>0.9)
  await widget.screenshot({path:path.join(output,'burger-'+scenario+'.png')})
  console.log(scenario+': '+expected+'%, desktop widget verified')
 }finally{await app.close()}
}
