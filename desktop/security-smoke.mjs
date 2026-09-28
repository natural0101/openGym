import {_electron as electron} from 'playwright'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile} from 'node:fs/promises'
import path from 'node:path'
const profile=await mkdtemp(path.resolve('desktop/test-output/security-'))
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
try{
 const p=await app.firstWindow();await p.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 assert.equal(await p.evaluate(()=>typeof require),'undefined');assert.equal(await p.evaluate(()=>typeof process),'undefined')
 const checks=await app.evaluate(async({BrowserWindow,ipcMain})=>{
  const w=BrowserWindow.getAllWindows()[0],prefs=w.webContents.getLastWebPreferences(),results=[]
  for(const channel of ['desktop:load','desktop:save','voice:info','voice:key']){
   const handler=ipcMain._invokeHandlers.get(channel)
   for(const event of [{sender:{},senderFrame:w.webContents.mainFrame},{sender:w.webContents,senderFrame:{url:'opengym://app/index.html'}},{sender:w.webContents,senderFrame:{url:'https://example.com'}}]){
    try{await handler(event);results.push(false)}catch(e){results.push(/Untrusted/.test(e.message))}
   }
  }
  return {sandbox:prefs.sandbox,contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration,denied:results}
 });assert(checks.sandbox&&checks.contextIsolation&&!checks.nodeIntegration);assert(checks.denied.every(Boolean))
 const csp=await p.evaluate(()=>fetch('./index.html').then(r=>r.headers.get('content-security-policy')));assert(csp.includes("default-src 'self'")&&csp.includes("frame-src 'none'"))
 const traversal=await p.evaluate(()=>fetch('opengym://app/%2e%2e%5cpackage.json').then(r=>r.status));assert.equal(traversal,403)
 const opening=app.waitForEvent('window');await p.evaluate(()=>window.openGymDesktop.showWidget());const widget=await opening;await widget.waitForURL('**/widget/index.html');assert.equal(await widget.evaluate(()=>typeof window.openGymDesktop),'undefined')
 const report={passed:true,ipcForgeryDenied:checks.denied.length,sandbox:true,nodeIntegration:false,contextIsolation:true,traversalStatus:traversal,widgetHasNoTrainingBridge:true}
 await writeFile('desktop/test-output/security-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await app.close()}
