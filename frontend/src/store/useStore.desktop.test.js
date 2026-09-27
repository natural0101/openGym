// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('../desktop/platform.js', () => ({ DESKTOP: true, desktop: () => ({ save }), DESKTOP_DEFAULTS: {} }))
import { useStore, DEF } from './useStore.js'
beforeEach(() => {
  localStorage.clear()
  save.mockReset().mockResolvedValue({ savedAt: 1 })
  useStore.setState({ S: structuredClone(DEF), user: null })
})
it('never publishes a failed draft or saves it with the next unrelated command', async () => {
  save.mockRejectedValueOnce(new Error('disk unavailable'))
  await expect(useStore.getState().update(s => { s.desktopVoiceReceipts = ['failed']; s.desktopName = 'failed' })).rejects.toThrow('disk unavailable')
  expect(useStore.getState().S.desktopName).toBeUndefined()
  expect(localStorage.getItem('gym_state_v1')).toBeNull()
  await useStore.getState().update(s => { s.restSec = 60 })
  const persisted = save.mock.calls[1][0]
  expect(persisted.desktopName).toBeUndefined()
  expect(persisted.desktopVoiceReceipts).toBeUndefined()
  expect(persisted.restSec).toBe(60)
})
it('serializes simultaneous edits against committed data without lost updates', async () => {
  let release
  save.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const first = useStore.getState().update(s => { s.desktopName = 'first' })
  const second = useStore.getState().update(s => { s.restSec = 75 })
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(useStore.getState().S.desktopName).toBeUndefined()
  release({ savedAt: 1 })
  await Promise.all([first, second])
  expect(useStore.getState().S).toMatchObject({ desktopName: 'first', restSec: 75 })
  expect(save.mock.calls[1][0].desktopName).toBe('first')
})
it('keeps a concurrent manual edit after a failed voice write', async () => {
  let reject
  save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  const first = useStore.getState().update(s => { s.desktopName = 'failed' })
  const failure = expect(first).rejects.toThrow('disk unavailable')
  const second = useStore.getState().update(s => { s.restSec = 120 })
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  reject(new Error('disk unavailable'))
  await failure; await second
  expect(useStore.getState().S.restSec).toBe(120)
  expect(useStore.getState().S.desktopName).toBeUndefined()
})
