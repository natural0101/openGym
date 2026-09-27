const test = require('node:test')
const assert = require('node:assert/strict')
const { dayOf, activityToday, reminderDue, reminderAction, createReminder } = require('../reminder.cjs')
const at = text => new Date(text)
const prefs = { enabled: true, time: '18:00', lastShownDay: null, pendingDay: null, restDay: null, snoozeUntil: 0 }
const workout = (d, done = true) => ({ d, entries: [{ sets: [{ w: 5, r: 10, done }] }] })
function harness(start = '2026-09-28T18:00:00', disk = new Map()) {
  let date = at(start), training = { workouts: [], active: null }, notifications = 0, opened = 0, reader
  const files = {
    async readFile(name) { if (!disk.has(name)) throw Object.assign(Error('missing'), { code: 'ENOENT' }); return disk.get(name) },
    async writeFile(name, value) { disk.set(name, value) },
    async rename(from, to) { disk.set(to, disk.get(from)); disk.delete(from) },
  }
  const service = createReminder({ filePath: 'test-preferences', files, now: () => date, readTraining: () => reader ? reader() : training, notify: () => { notifications++ }, onOpen: () => { opened++ } })
  return { service, disk, date: value => { date = at(value) }, training: value => { training = value }, reader: fn => { reader = fn }, notifications: () => notifications, opened: () => opened }
}
test('disabled by default; local chosen minute is inclusive', async () => {
  const h = harness(); await h.service.load(); assert.equal(h.service.info().enabled, false); assert.equal(await h.service.check(), false)
  assert.equal(reminderDue(prefs, {}, at('2026-09-28T17:59:59')), false)
  assert.equal(reminderDue(prefs, {}, at('2026-09-28T18:00:00')), true)
})
test('today activity suppresses completed, active and one-side sets, not unchecked plans', () => {
  const now = at('2026-09-28T19:00:00')
  assert.equal(activityToday({ active: workout('2026-09-28') }, now), true)
  assert.equal(reminderDue(prefs, { workouts: [workout('2026-09-28')] }, now), false)
  assert.equal(activityToday({ active: workout('2026-09-28', false) }, now), false)
  assert.equal(activityToday({ workouts: [workout('2026-09-27')] }, now), false)
  assert.equal(activityToday({ active: { d: '2026-09-28', entries: [{ sets: [{ sides: { L: { done: true }, R: { done: false } } }] }] } }, now), true)
})
test('notification occurs once per day and pending banner survives restart', async () => {
  const h = harness(); await h.service.load(); await h.service.configure({ enabled: true, time: '18:00' })
  assert.equal(await h.service.check(), true); assert.equal(await h.service.check(), false); assert.equal(h.notifications(), 1)
  const restarted = harness('2026-09-28T21:00:00', h.disk); await restarted.service.load()
  assert.equal(restarted.service.info().pendingDay, '2026-09-28'); assert.equal(await restarted.service.check(), false)
})
test('later waits thirty minutes including across midnight', () => {
  const later = reminderAction(prefs, 'later', at('2026-09-28T23:50:00'))
  assert.equal(reminderDue(later, {}, at('2026-09-29T00:19:59')), false)
  assert.equal(reminderDue(later, {}, at('2026-09-29T00:20:00')), true)
})
test('today rest persists, and tomorrow resumes at the configured local time', async () => {
  const h = harness(); await h.service.load(); await h.service.configure({ enabled: true, time: '18:00' }); await h.service.action('rest')
  const restarted = harness('2026-09-28T23:59:59', h.disk); await restarted.service.load()
  assert.equal(await restarted.service.check(), false)
  restarted.date('2026-09-29T00:00:00'); assert.equal(await restarted.service.check(), false)
  restarted.date('2026-09-29T18:00:00'); assert.equal(await restarted.service.check(), true)
})
test('activity clears snooze and banner rather than creating a nag next morning', async () => {
  const h = harness(); await h.service.load(); await h.service.configure({ enabled: true, time: '18:00' }); await h.service.check(); await h.service.action('later')
  h.training({ active: workout('2026-09-28'), workouts: [] }); await h.service.check()
  assert.equal(h.service.info().snoozeUntil, 0); assert.equal(h.service.info().pendingDay, null)
  h.training({ workouts: [] }); h.date('2026-09-29T09:00:00'); assert.equal(await h.service.check(), false)
})
for (const action of ['disable', 'rest', 'later']) test(`slow training read cannot fire after ${action}`, async () => {
  const h = harness(); await h.service.load(); await h.service.configure({ enabled: true, time: '18:00' })
  let resolveRead
  h.reader(() => new Promise(resolve => { resolveRead = resolve }))
  const check = h.service.check(); await new Promise(setImmediate)
  if (action === 'disable') await h.service.configure({ enabled: false, time: '18:00' }); else await h.service.action(action)
  resolveRead({ workouts: [] }); assert.equal(await check, false); assert.equal(h.notifications(), 0)
  if (action === 'disable') assert.equal(h.service.info().enabled, false)
  if (action === 'rest') assert.equal(h.service.info().restDay, '2026-09-28')
  if (action === 'later') assert.ok(h.service.info().snoozeUntil > 0)
})
test('queued preference changes preserve suppression and explicit disable', async () => {
  const h = harness(); await h.service.load()
  await Promise.all([h.service.configure({ enabled: true, time: '19:30' }), h.service.action('rest'), h.service.configure({ enabled: false, time: '20:00' })])
  assert.equal(h.service.info().enabled, false); assert.equal(h.service.info().time, '20:00'); assert.equal(h.service.info().restDay, '2026-09-28')
})
test('invalid settings fail without enabling reminders and open is explicit', async () => {
  const h = harness(); await h.service.load(); await assert.rejects(h.service.configure({ enabled: true, time: '24:60' }))
  assert.equal(h.service.info().enabled, false); assert.equal(h.opened(), 0)
  await h.service.action('open'); assert.equal(h.opened(), 1)
  assert.equal(dayOf(at('2026-01-01T00:00:00')), '2026-01-01')
})
