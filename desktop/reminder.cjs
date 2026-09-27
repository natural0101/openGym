const fs = require('node:fs/promises')
const dayOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const defaults = () => ({ enabled: false, time: '18:00', lastShownDay: null, restDay: null, pendingDay: null, snoozeUntil: 0 })
function activityToday(state, date = new Date()) {
  const today = dayOf(date)
  const performed = workout => workout?.d === today && workout.entries?.some(entry => entry.sets?.some(set => set.done === true || set.sides?.L?.done === true || set.sides?.R?.done === true))
  return !!(performed(state?.active) || state?.workouts?.some(performed))
}
function reminderDue(prefs, state, date = new Date()) {
  if (!prefs.enabled || !/^([01]\d|2[0-3]):[0-5]\d$/.test(prefs.time)) return false
  if (prefs.restDay === dayOf(date) || activityToday(state, date)) return false
  if (prefs.snoozeUntil > 0) return date.getTime() >= prefs.snoozeUntil
  if (prefs.lastShownDay === dayOf(date)) return false
  const [hours, minutes] = prefs.time.split(':').map(Number)
  return date.getHours() * 60 + date.getMinutes() >= hours * 60 + minutes
}
function reminderAction(prefs, action, date = new Date()) {
  if (!['later', 'rest', 'open', 'dismiss'].includes(action)) throw Error('Неизвестное действие напоминания.')
  return { ...prefs, pendingDay: null, lastShownDay: dayOf(date), snoozeUntil: action === 'later' ? date.getTime() + 30 * 60000 : 0, ...(action === 'rest' ? { restDay: dayOf(date) } : {}) }
}
function createReminder({ filePath, readTraining, notify, onOpen, onChange = () => {}, now = () => new Date(), files = fs }) {
  let prefs = defaults(), writes = Promise.resolve(), checking = false, disposed = false, revision = 0
  const persist = next => {
    writes = writes.catch(() => {}).then(async () => {
      const value = typeof next === 'function' ? next(prefs) : next
      if (!value) return null
      await files.writeFile(filePath + '.tmp', JSON.stringify(value), { mode: 0o600 })
      await files.rename(filePath + '.tmp', filePath)
      prefs = value
      onChange({ ...prefs })
      return { ...prefs }
    })
    return writes
  }
  return {
    async load() {
      try {
        const saved = JSON.parse(await files.readFile(filePath, 'utf8'))
        prefs = { ...defaults(), enabled: saved.enabled === true, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time) ? saved.time : '18:00', lastShownDay: typeof saved.lastShownDay === 'string' ? saved.lastShownDay : null, restDay: typeof saved.restDay === 'string' ? saved.restDay : null, pendingDay: typeof saved.pendingDay === 'string' ? saved.pendingDay : null, snoozeUntil: Number.isFinite(saved.snoozeUntil) && saved.snoozeUntil > 0 ? saved.snoozeUntil : 0 }
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      return { ...prefs }
    },
    info: () => ({ ...prefs }),
    async configure(patch) {
      if (!patch || typeof patch.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) throw Error('Выбери время напоминания в формате ЧЧ:ММ.')
      revision++
      return persist(current => ({ ...current, enabled: patch.enabled, time: patch.time, ...(patch.enabled ? {} : { snoozeUntil: 0, pendingDay: null }) }))
    },
    async action(action) {
      reminderAction(prefs, action, now()) // Validate before queuing a write.
      revision++
      const result = await persist(current => reminderAction(current, action, now()))
      if (action === 'open') onOpen()
      return result
    },
    async check() {
      if (disposed || checking) return false
      checking = true
      try {
        await writes.catch(() => {})
        const version = revision
        const state = await readTraining(), date = now()
        if (disposed || version !== revision) return false
        if (activityToday(state, date) && (prefs.snoozeUntil || prefs.pendingDay)) {
          await persist(current => version === revision ? { ...current, lastShownDay: dayOf(date), snoozeUntil: 0, pendingDay: null } : null); return false
        }
        if (!reminderDue(prefs, state, date)) return false
        // Record before displaying: restart must not repeat a Windows notification.
        // The banner remains available until an action or today's activity clears it.
        const shown = await persist(current => version === revision ? { ...reminderAction(current, 'dismiss', date), pendingDay: dayOf(date) } : null)
        if (!shown || disposed || version !== revision || !prefs.enabled) return false
        await notify()
        return true
      } finally { checking = false }
    },
    dispose() { disposed = true },
    flush: () => writes,
  }
}
module.exports = { dayOf, activityToday, reminderDue, reminderAction, createReminder }
