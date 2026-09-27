const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createStorage, validateState } = require('../storage.cjs')
const state = i => ({ routines: [], workouts: [], bodyweight: [], week: {}, counter: i })
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opengym-storage-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return { dir, storage: createStorage(dir) }
}
test('new install has no history; queued writes survive a fresh process', async t => {
  const { dir, storage } = await setup(t)
  assert.equal((await storage.read()).state, null)
  await Promise.all(Array.from({ length: 20 }, (_, i) => storage.write(state(i))))
  assert.equal((await createStorage(dir).read()).state.counter, 19)
  assert.equal(JSON.parse(await fs.readFile(storage.file + '.previous')).counter, 18)
})
test('invalid input cannot replace a valid profile', async t => {
  const { storage } = await setup(t)
  await storage.write(state(7))
  assert.throws(() => storage.write({ routines: [], workouts: 'oops' }))
  assert.throws(() => validateState({ ...state(0), routines: [null] }))
  assert.throws(() => validateState(JSON.parse('{"routines":[],"workouts":[],"bodyweight":[],"week":{},"__proto__":{}}')))
  assert.equal((await storage.read()).state.counter, 7)
})
test('corruption recovers previous valid file and preserves damaged original', async t => {
  const { dir, storage } = await setup(t)
  await storage.write(state(1)); await storage.write(state(2))
  await fs.writeFile(storage.file, '{corrupt')
  const result = await createStorage(dir).read()
  assert.equal(result.recovered, true)
  assert.equal(result.state.counter, 1)
  const bad = (await fs.readdir(dir)).find(n => n.startsWith('unreadable-'))
  assert.equal(await fs.readFile(path.join(dir, bad), 'utf8'), '{corrupt')
})
test('unrecoverable data is not silently reset; explicit restore works', async t => {
  const { storage } = await setup(t)
  await fs.writeFile(storage.file, '{bad')
  await assert.rejects(storage.read())
  await assert.rejects(storage.write(state(3)))
  assert.equal(await fs.readFile(storage.file, 'utf8'), '{bad')
  await storage.write(state(4), true)
  assert.equal((await storage.read()).state.counter, 4)
})
test('import snapshots are bounded and retain the replaced profile', async t => {
  const { storage } = await setup(t)
  for (let i = 0; i < 35; i++) await storage.write(state(i), true)
  const backups = (await fs.readdir(storage.backupDir)).filter(n => n.endsWith('.json')).sort()
  assert.equal(backups.length, 30)
  assert.equal(JSON.parse(await fs.readFile(path.join(storage.backupDir, backups.at(-1)))).counter, 33)
})

test('missing primary recovers previous state; damaged recovery copies never look like a new install', async t => {
  const { dir, storage } = await setup(t)
  await storage.write(state(1)); await storage.write(state(2))
  await fs.unlink(storage.file)
  assert.equal((await createStorage(dir).read()).state.counter, 1)
  await fs.unlink(storage.file)
  await fs.writeFile(storage.file + '.previous', '{bad')
  for (const name of await fs.readdir(storage.backupDir)) await fs.writeFile(path.join(storage.backupDir, name), '{bad')
  await assert.rejects(createStorage(dir).read())
})

test('burger challenge rejects malformed calendar/progress before replacing saved data', async t => {
  const { storage } = await setup(t)
  const game = {version:1,remaining:100,startedDay:'2026-09-25',day:'2026-09-25',completedDays:[],rewardedIds:[],sessions:0,misses:0,won:false,plan:{week:{5:true},days:{}},last:null}
  await storage.write({...state(1),desktopBurger:game})
  for (const patch of [{day:'not-a-date'},{day:'2026-02-31'},{remaining:151},{remaining:0,won:false},{completedDays:'bad'},{plan:{week:{5:'yes'},days:{}}}]) {
    assert.throws(()=>storage.write({...state(2),desktopBurger:{...game,...patch}}))
  }
  assert.equal((await storage.read()).state.desktopBurger.remaining,100)
})
