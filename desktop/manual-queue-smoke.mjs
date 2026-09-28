import {_electron as electron} from 'playwright'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
const profile=await mkdtemp(path.resolve('desktop/test-output/manual-queue-'))
const errors=[],checks=[]
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
const page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message))
const disk=async()=>JSON.parse(await readFile(path.join(profile,'training.json'),'utf8'))
try {
 await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor()
 await page.context().setOffline(true)
 await page.getByRole('button',{name:'Добавить',exact:true}).click()
 await page.getByRole('button',{name:'Свободная тренировка (выбирай по ходу)',exact:true}).click()
 await page.getByRole('button',{name:'Добавить упражнение',exact:true}).waitFor()
 assert((await disk()).active);checks.push('Manual freestyle start persists before workout UI')
 await page.getByRole('button',{name:'Добавить упражнение',exact:true}).click()
 await page.getByPlaceholder(/^Поиск .*упражнений/).fill('Жим гантелей стоя')
 await page.getByRole('button',{name:'Добавить «Жим гантелей над головой стоя»',exact:true}).click()
 await page.keyboard.press('Escape')
 await page.getByRole('checkbox').first().waitFor()
 await page.getByRole('checkbox').first().click()
 await page.waitForFunction(()=>document.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')==='true')
 const active=await disk();assert.equal(active.active.entries[0].sets[0].done,true)
 checks.push('Add exercise and check set persisted on disk')
 await page.locator('#timer.rest').waitFor();checks.push('Manual checked set starts rest after durable save')
 await page.getByRole('button',{name:'Завершить',exact:true}).click()
 await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click()
 await page.locator('.center').waitFor()
 await page.waitForFunction(async()=>{const {state}=await window.openGymDesktop.load();return state.active===null&&state.workouts.length===1})
 assert.equal((await disk()).workouts.length,1);assert.equal((await disk()).active,null)
 checks.push('Manual finish persists one workout and clears active')
 await page.keyboard.press('Escape')
 await page.evaluate(()=>location.hash='#/settings')
 await page.getByPlaceholder('Имя (необязательно)').pressSequentially('Тест ввода',{delay:15})
 await page.getByLabel('Тема',{exact:true}).selectOption('dark')
 await page.waitForFunction(async()=>{const {state}=await window.openGymDesktop.load();return state.desktopName==='Тест ввода'&&state.theme==='dark'})
 assert.equal(await page.getByPlaceholder('Имя (необязательно)').inputValue(),'Тест ввода')
 checks.push('Controlled profile input keeps sequential keystrokes; select persists captured value')
 assert.deepEqual(errors,[])
 await writeFile('desktop/test-output/manual-queue-report.json',JSON.stringify({passed:true,profile,checks,errors},null,2))
 console.log(JSON.stringify({passed:true,profile,checks,errors}))
} catch(e){console.log('BODY',await page.locator('body').innerText());throw e} finally {await app.close()}


