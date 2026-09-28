// Destructive installation/uninstallation is restricted to an ephemeral GitHub runner.
import {_electron as electron} from 'playwright'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile,access,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP||process.platform!=='win32')throw Error('Run only in a disposable GitHub Windows runner')
const exec=promisify(execFile),version=JSON.parse(await readFile('package.json','utf8')).version
const installDir=path.resolve(process.env.RUNNER_TEMP,'opengym-installer-check'),exe=path.join(installDir,'openGym.exe')
const installer=path.resolve(`release/openGym-Setup-${version}-x64.exe`)
await exec(installer,['/S',`/D=${installDir}`],{windowsHide:true,timeout:120000})
await access(exe)
let app,profile
try{
 app=await electron.launch({executablePath:exe});let p=await app.firstWindow();await p.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 const info=await p.evaluate(()=>window.openGymDesktop.info());assert.equal(info.version,version);assert(info.packaged);profile=info.dataDir
 const s=(await p.evaluate(()=>window.openGymDesktop.load())).state;assert.equal(s.active,null);assert.deepEqual(s.workouts,[]);assert.equal((await p.evaluate(()=>window.openGymDesktop.voiceInfo())).hasKey,false)
 await p.getByRole('button',{name:'Настройки',exact:true}).click();await p.getByPlaceholder('Имя (необязательно)').fill('Installer persistence check');await p.waitForFunction(async()=>(await window.openGymDesktop.load()).state.desktopName==='Installer persistence check')
 await app.close();app=null
 // Installing over the existing version exercises NSIS upgrade and preservation.
 await exec(installer,['/S',`/D=${installDir}`],{windowsHide:true,timeout:120000})
 app=await electron.launch({executablePath:exe});p=await app.firstWindow();await p.getByRole('heading',{name:'Сегодня',exact:true}).waitFor();assert.equal((await p.evaluate(()=>window.openGymDesktop.load())).state.desktopName,'Installer persistence check')
 await app.close();app=null
 await exec(path.join(installDir,'Uninstall openGym.exe'),['/S'],{windowsHide:true,timeout:120000})
 for(let i=0;i<40;i++){if(!await access(exe).then(()=>true,()=>false))break;await new Promise(r=>setTimeout(r,250))}
 assert.equal(await access(exe).then(()=>true,()=>false),false)
 assert.equal(JSON.parse(await readFile(path.join(profile,'training.json'),'utf8')).desktopName,'Installer persistence check')
 const report={passed:true,version,freshInstall:true,packaged:true,upgradePreservesData:true,uninstallPreservesData:true}
 await writeFile('desktop/test-output/installer-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await app?.close()}
