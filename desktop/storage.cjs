const fs = require('node:fs/promises')
const path = require('node:path')
const MAX_BYTES = 20 * 1024 * 1024

function validateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Нужен файл резервной копии openGym.')
  for (const key of ['routines', 'workouts', 'bodyweight']) {
    if (!Array.isArray(value[key])) throw new Error(`В копии отсутствует список ${key}.`)
  }
  if (!value.week || typeof value.week !== 'object' || Array.isArray(value.week)) throw new Error('Некорректное расписание.')
  for (const [day, ids] of Object.entries(value.week)) if (!/^[0-6]$/.test(day) || !(typeof ids === 'string' || Array.isArray(ids) && ids.every(id => typeof id === 'string'))) throw new Error('Некорректный день в расписании.')
  for (const key of ['customEx', 'equipProfiles', 'favEx', 'gymCards']) if (value[key] != null && !Array.isArray(value[key])) throw new Error(`Некорректное поле ${key}.`)
  for (const key of ['dayPlan', 'exWeights', 'exNotes', 'barWeights', 'wc']) if (value[key] != null && (typeof value[key] !== 'object' || Array.isArray(value[key]))) throw new Error(`Некорректное поле ${key}.`)
  if (value.desktopBurger != null) {
    const g = value.desktopBurger
    const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00')) && new Date(v + 'T12:00:00').getDate() === Number(v.slice(-2))
    if (g.version !== 1 || !Number.isInteger(g.remaining) || g.remaining < 0 || g.remaining > 150 || !day(g.day) || !day(g.startedDay)
      || typeof g.won !== 'boolean' || g.won !== (g.remaining === 0)
      || !Number.isInteger(g.sessions) || g.sessions < 0 || !Number.isInteger(g.misses) || g.misses < 0
      || !Array.isArray(g.rewardedIds) || !g.rewardedIds.every(id => typeof id === 'string')
      || !Array.isArray(g.completedDays) || !g.completedDays.every(day)
      || !g.plan?.week || !g.plan?.days || Array.isArray(g.plan.week) || Array.isArray(g.plan.days)
      || !Object.entries(g.plan.week).every(([key, v]) => /^[0-6]$/.test(key) && typeof v === 'boolean')
      || !Object.entries(g.plan.days).every(([key, v]) => day(key) && typeof v === 'boolean')) throw new Error('Некорректный прогресс Бургера.')
  }
  for (const r of value.routines) {
    if (!r || typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.ex)) throw new Error('Некорректная программа.')
    for (const ex of r.ex) if (!ex || typeof ex.id !== 'string') throw new Error('Некорректное упражнение.')
  }
  for (const w of value.workouts) if (!w || typeof w.id !== 'string' || typeof w.d !== 'string' || !Array.isArray(w.entries)) throw new Error('Некорректная тренировка.')
  for (const b of value.bodyweight) if (!b || typeof b.d !== 'string' || !Number.isFinite(b.w)) throw new Error('Некорректная запись веса.')
  if (value.active != null && (!value.active || typeof value.active !== 'object' || typeof value.active.id !== 'string' || !Array.isArray(value.active.entries))) throw new Error('Некорректная активная тренировка.')
  for (const workout of [...value.workouts, ...(value.active ? [value.active] : [])]) {
    for (const entry of workout.entries) if (!entry || typeof entry.id !== 'string' || !Array.isArray(entry.sets) || entry.sets.some(s => !s || typeof s !== 'object' || Array.isArray(s))) throw new Error('Некорректные подходы в тренировке.')
  }
  const text = JSON.stringify(value)
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Копия превышает 20 МБ.')
  JSON.parse(text, (key, item) => { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Недопустимое поле в копии.'); return item })
  return text
}

function createStorage(dir) {
  const file = path.join(dir, 'training.json')
  const backupDir = path.join(dir, 'backups')
  let queue = Promise.resolve()
  const atomic = async (dest, text) => {
    const tmp = dest + '.tmp'
    const fd = await fs.open(tmp, 'w', 0o600)
    try { await fd.writeFile(text, 'utf8'); await fd.sync() } finally { await fd.close() }
    await fs.rename(tmp, dest)
  }
  const snapshot = async text => {
    await fs.mkdir(backupDir, { recursive: true })
    const name = `training-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await atomic(path.join(backupDir, name), text)
    const names = (await fs.readdir(backupDir)).filter(n => /^training-.*\.json$/.test(n)).sort().reverse()
    await Promise.all(names.slice(30).map(n => fs.unlink(path.join(backupDir, n))))
  }
  const read = async () => {
    await fs.mkdir(dir, { recursive: true })
    try {
      const state = JSON.parse(await fs.readFile(file, 'utf8')); validateState(state)
      return { state, recovered: false }
    } catch (e) {
      const candidates = [file + '.previous', ...(await fs.readdir(backupDir).catch(() => [])).filter(n => n.endsWith('.json')).sort().reverse().map(n => path.join(backupDir, n))]
      let recoveryFileExists = false
      for (const candidate of candidates) {
        try {
          const text = await fs.readFile(candidate, 'utf8')
          recoveryFileExists = true
          const state = JSON.parse(text); validateState(state)
          if (e.code !== 'ENOENT') await fs.copyFile(file, path.join(dir, `unreadable-${Date.now()}.json`))
          await atomic(file, text)
          return { state, recovered: true }
        } catch {}
      }
      if (e.code === 'ENOENT' && !recoveryFileExists) return { state: null, recovered: false }
      throw new Error('Файл тренировок повреждён. Исходный файл сохранён; восстановите JSON-копию в настройках.')
    }
  }
  let lastBackupDay = null
  const write = (state, forceBackup = false) => {
    const text = validateState(state)
    const job = queue.catch(() => {}).then(async () => {
      await fs.mkdir(dir, { recursive: true })
      const previous = await fs.readFile(file, 'utf8').catch(e => { if (e.code !== 'ENOENT') throw e; return null })
      // Validate the old copy before rotating it. A corrupt file is never silently overwritten.
      if (previous) {
        try { validateState(JSON.parse(previous)) } catch (e) { if (!forceBackup) throw e }
        await atomic(file + '.previous', previous)
        const day = new Date().toISOString().slice(0, 10)
        if (forceBackup || day !== lastBackupDay) { await snapshot(previous); lastBackupDay = day }
      }
      await atomic(file, text)
      return { savedAt: Date.now() }
    })
    queue = job
    return job
  }
  return { read, write, flush: () => queue, file, backupDir, validateState }
}
module.exports = { createStorage, validateState, MAX_BYTES }
