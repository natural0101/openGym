import {_electron as electron} from 'playwright'
import {mkdtemp, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const profile=await mkdtemp(path.resolve('desktop/test-output/queued-close-'))
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
try {
 const page=await app.firstWindow(); await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 await page.evaluate(()=>location.hash='/settings')
 const name=page.getByLabel('Как тебя называть',{exact:true});await name.waitFor()
 await app.evaluate(({ipcMain})=>{
   const handler=ipcMain._invokeHandlers.get('desktop:save');globalThis.queuedSaveCalls=0
   ipcMain.removeHandler('desktop:save')
   ipcMain.handle('desktop:save',async(...args)=>{globalThis.queuedSaveCalls++;await new Promise(r=>setTimeout(r,900));return handler(...args)})
 })
 await name.fill('Первая запись')
 await name.fill('Вторая запись сохранена')
 assert.equal(await app.evaluate(()=>globalThis.queuedSaveCalls),1,'Second write must still be waiting in renderer queue')
 const closed=new Promise(resolve=>app.once('close',resolve))
 await app.evaluate(({app})=>{setTimeout(()=>app.quit(),0)})
 await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Close timed out')),15000))])
 const state=JSON.parse(await readFile(path.join(profile,'training.json'),'utf8'))
 assert.equal(state.desktopName,'Вторая запись сохранена')
 const report={profile,passed:true,check:'Queued second renderer mutation persisted before app quit',desktopName:state.desktopName}
 await writeFile('desktop/test-output/queued-close-report.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report))
} finally {await app.close().catch(()=>{})}
