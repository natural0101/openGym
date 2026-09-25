import { _electron as electron } from 'playwright'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import k from 'koffi'
const u=k.load('user32.dll')
const R=k.struct('LayerRect',{left:'long',top:'long',right:'long',bottom:'long'})
const P=k.struct('LayerPoint',{x:'long',y:'long'})
const parent=u.func('void* __stdcall GetParent(void*)')
const find=u.func('void* __stdcall FindWindowExW(void*, void*, str16, str16)')
const style=u.func('intptr_t __stdcall GetWindowLongPtrW(void*, int)')
const getRect=u.func('GetWindowRect','bool',['void*',k.out(k.pointer(R))])
const hit=u.func('WindowFromPoint','void*',[P])
const ancestor=u.func('void* __stdcall GetAncestor(void*, uint32_t)')
const isChild=u.func('bool __stdcall IsChild(void*, void*)')
const visible=u.func('bool __stdcall IsWindowVisible(void*)')
const output=path.resolve('desktop/test-output')
await mkdir(output,{recursive:true})
const profile=await mkdtemp(path.join(output,'desktop-layer-'))
await writeFile(path.join(profile,'widget-preferences.json'),JSON.stringify({visible:false,pinned:true,x:800,y:240}))
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
let minimized=false
const shell=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(New-Object -ComObject Shell.Application).${action}()`],{windowsHide:true})
try {
 const page=await app.firstWindow()
 await page.getByRole('heading',{name:'Домашние тренировки',exact:true}).waitFor()
 const opening=app.waitForEvent('window')
 await page.getByRole('button',{name:/На рабочий стол/}).click()
 const widget=await opening;await widget.waitForURL('**/widget/index.html')
 await widget.waitForFunction(()=>document.querySelector('.widget').dataset.desktop==='true')
 const info=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/widget/'));return {hwnd:String(w.getNativeWindowHandle().readBigUInt64LE()),alwaysOnTop:w.isAlwaysOnTop()}})
 const hwnd=BigInt(info.hwnd)
 const native={child:!!(Number(style(hwnd,-16))&0x40000000),topmost:!!(Number(style(hwnd,-20))&8),desktopParent:!!find(parent(hwnd),null,'SHELLDLL_DefView',null),alwaysOnTop:info.alwaysOnTop}
 assert.deepEqual(native,{child:true,topmost:false,desktopParent:true,alwaysOnTop:false})
 shell('MinimizeAll');minimized=true
 await page.waitForTimeout(700)
 const rect={};getRect(hwnd,rect)
 const point={x:rect.left+80,y:rect.top+310};const found=hit(point)
 const desktopVisible={visible:visible(hwnd),receivesDesktopClicks:String(found)===String(hwnd)||isChild(hwnd,found)}
 assert.deepEqual(desktopVisible,{visible:true,receivesDesktopClicks:true})
 await widget.screenshot({path:path.join(output,'burger-desktop-layer.png')})
 const screenCapture=path.join(output,'burger-desktop-screen.png')
 const pixelReport=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('desktop/capture-widget-screen.ps1')],{windowsHide:true,encoding:'utf8',env:{...process.env,GYM_CAPTURE_PATH:screenCapture,GYM_CAPTURE_RECT:[rect.left,rect.top,rect.right-rect.left,rect.bottom-rect.top].join(',')}}))
 assert(pixelReport.violetFraction > .25, 'Actual desktop pixels must contain the violet widget, not wallpaper')
 assert(pixelReport.yellowFraction > .025, 'Actual desktop pixels must contain the yellow action button')
 const padding=40, surround=[rect.left-padding,rect.top-padding,rect.right-rect.left+padding*2,rect.bottom-rect.top+padding*2].join(',')
 const beforePath=path.join(output,'desktop-without-widget.png'),afterPath=path.join(output,'desktop-widget-surroundings.png')
 const captureSurrounding=file=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('desktop/capture-widget-screen.ps1')],{windowsHide:true,env:{...process.env,GYM_CAPTURE_PATH:file,GYM_CAPTURE_RECT:surround}})
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/widget/')).hide())
 await page.waitForTimeout(150);captureSurrounding(beforePath)
 await page.evaluate(()=>window.openGymDesktop.showWidget())
 await page.waitForTimeout(150);captureSurrounding(afterPath)
 const surroundings=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('desktop/compare-widget-surroundings.ps1')],{windowsHide:true,encoding:'utf8',env:{...process.env,GYM_BEFORE_PATH:beforePath,GYM_AFTER_PATH:afterPath,GYM_WIDGET_HANDLE:String(hwnd),GYM_CAPTURE_PADDING:String(padding)}}))
 assert(surroundings.changedFraction<.001,'Static desktop pixels outside the widget must remain unchanged: '+JSON.stringify(surroundings))
 const coverHwnd=await app.evaluate(async({BrowserWindow},bounds)=>{
  const cover=new BrowserWindow({x:bounds.left,y:bounds.top,width:400,height:540,show:false,frame:false,backgroundColor:'#fffdf5'})
  await cover.loadURL('data:text/html,<h1>Window above desktop widget</h1>');cover.show();cover.moveTop();cover.focus();global.gymCover=cover
  return String(cover.getNativeWindowHandle().readBigUInt64LE())
 },rect)
 await page.waitForTimeout(300)
 assert.equal(String(ancestor(hit(point),2)),coverHwnd,'Ordinary application must cover widget')
 await app.evaluate(()=>global.gymCover.destroy())
 shell('UndoMinimizeALL');minimized=false
 const report={native,desktopVisible,ordinaryWindowCoversWidget:true,screenPixels:pixelReport,surroundings}
 console.log(JSON.stringify(report,null,2));await writeFile(path.join(output,'desktop-layer-report.json'),JSON.stringify(report,null,2))
} finally {if(minimized)shell('UndoMinimizeALL');await app.close()}
