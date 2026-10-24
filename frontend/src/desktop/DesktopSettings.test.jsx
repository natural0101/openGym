// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DesktopSettings from './DesktopSettings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  state: null,
  api: {
    info: vi.fn(), mediaStatus: vi.fn(), onMediaProgress: vi.fn(),
    exportBackup: vi.fn(), importBackup: vi.fn(), restoreBackup: vi.fn(),
    openDataFolder: vi.fn(), save: vi.fn(), downloadMedia: vi.fn(), pauseMedia: vi.fn(),
  },
  confirmSheet: vi.fn(), toast: vi.fn(), setState: vi.fn(), replaceState: vi.fn(),
}))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.state)
  useStore.getState = () => mocks.state
  useStore.setState = (...args) => mocks.setState(...args)
  return { useStore, DEF: { routines: [], workouts: [] } }
})
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ toast: mocks.toast }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: (...args) => mocks.confirmSheet(...args) }))
vi.mock('../components/Icon.jsx', () => ({ default: () => null }))
vi.mock('../components/ui.jsx', () => ({ Switch: () => null }))
vi.mock('./platform.js', () => ({ desktop: () => mocks.api, DESKTOP_DEFAULTS: {} }))
vi.mock('./DesktopHome.jsx', () => ({ openHomePlan: vi.fn() }))
vi.mock('./VoiceConnection.jsx', () => ({ default: () => null }))
vi.mock('./MotivationSettings.jsx', () => ({ default: () => null }))

let host, root
const backup = { routines: [{ id: 'routine' }], workouts: [{ id: 'workout' }] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.state = {
    S: { desktopName: '', theme: 'light', workoutView: 'cards', restSec: 75 },
    desktopSave: { status: 'saved' }, update: vi.fn(), replaceState: mocks.replaceState,
  }
  mocks.setState.mockImplementation(patch => Object.assign(mocks.state, patch))
  mocks.api.info.mockResolvedValue({ version: 'test', dataDir: 'isolated-test-profile' })
  mocks.api.mediaStatus.mockResolvedValue({ state: 'local-only', downloadsEnabled: false, completed: 0, total: 1 })
  mocks.api.onMediaProgress.mockReturnValue(vi.fn())
  mocks.api.exportBackup.mockResolvedValue({ canceled: false })
  mocks.api.importBackup.mockResolvedValue(backup)
  mocks.api.restoreBackup.mockResolvedValue(backup)
  mocks.api.openDataFolder.mockResolvedValue(undefined)
  mocks.api.save.mockResolvedValue({ savedAt: 1 })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(async () => { root.render(<DesktopSettings />) })
const button = text => [...host.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const click = text => act(async () => { const node = button(text); expect(node).toBeTruthy(); node.click() })
const alert = () => host.querySelector('[role="alert"]')

describe('DesktopSettings action retries', () => {
  it('retries export rather than saving training data', async () => {
    mocks.api.exportBackup.mockRejectedValueOnce(new Error('Export destination unavailable'))
    await mount()
    await click('Экспортировать')
    expect(alert().textContent).toContain('Export destination unavailable')
    await click('Повторить действие')
    expect(mocks.api.exportBackup).toHaveBeenCalledTimes(2)
    expect(mocks.api.save).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('Резервная копия сохранена')
    expect(alert()).toBeNull()
  })

  it('retries opening the import file and still requires confirmation before restoring', async () => {
    mocks.api.importBackup.mockRejectedValueOnce(new Error('Cannot read selected backup'))
    await mount()
    await click('Восстановить')
    expect(alert().textContent).toContain('Cannot read selected backup')
    await click('Повторить действие')
    expect(mocks.api.importBackup).toHaveBeenCalledTimes(2)
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    expect(mocks.api.restoreBackup).not.toHaveBeenCalled()
    expect(mocks.api.save).not.toHaveBeenCalled()
    await act(async () => { await mocks.confirmSheet.mock.calls[0][0].onConfirm() })
    expect(mocks.api.restoreBackup).toHaveBeenCalledWith(backup)
    expect(mocks.replaceState).toHaveBeenCalledWith(backup)
    expect(alert()).toBeNull()
  })

  it('retries the exact confirmed restore after a restore failure', async () => {
    mocks.api.restoreBackup.mockRejectedValueOnce(new Error('Restore disk unavailable'))
    await mount()
    await click('Восстановить')
    await act(async () => { await mocks.confirmSheet.mock.calls[0][0].onConfirm() })
    expect(alert().textContent).toContain('Restore disk unavailable')
    expect(mocks.replaceState).not.toHaveBeenCalled()
    await click('Повторить действие')
    expect(mocks.api.restoreBackup.mock.calls).toEqual([[backup], [backup]])
    expect(mocks.api.importBackup).toHaveBeenCalledTimes(1)
    expect(mocks.api.save).not.toHaveBeenCalled()
    expect(mocks.replaceState).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Данные восстановлены')
  })

  it('retries opening the data folder rather than saving training data', async () => {
    mocks.api.openDataFolder.mockRejectedValueOnce(new Error('Folder cannot be opened'))
    await mount()
    await click('Открыть папку данных')
    expect(alert().textContent).toContain('Folder cannot be opened')
    await click('Повторить действие')
    expect(mocks.api.openDataFolder).toHaveBeenCalledTimes(2)
    expect(mocks.api.save).not.toHaveBeenCalled()
    expect(alert()).toBeNull()
  })

  it('keeps an actual training-save retry mapped to saving the current state', async () => {
    mocks.state.desktopSave = { status: 'error', message: 'Training disk unavailable' }
    await mount()
    expect(alert().textContent).toContain('Training disk unavailable')
    await click('Повторить сохранение')
    expect(mocks.api.save).toHaveBeenCalledWith(mocks.state.S)
    expect(mocks.setState).toHaveBeenCalledWith({ desktopSave: { status: 'saved' } })
    expect(mocks.api.exportBackup).not.toHaveBeenCalled()
    expect(mocks.api.importBackup).not.toHaveBeenCalled()
    expect(alert()).toBeNull()
  })

  it('retries failed profile information loading without writing training data', async () => {
    mocks.api.info.mockRejectedValueOnce(new Error('Profile information unavailable'))
    await mount()
    expect(alert().textContent).toContain('Profile information unavailable')
    await click('Повторить действие')
    expect(mocks.api.info).toHaveBeenCalledTimes(2)
    expect(mocks.api.save).not.toHaveBeenCalled()
    expect(host.textContent).toContain('isolated-test-profile')
    expect(alert()).toBeNull()
  })

  it('disables backup action buttons while an export retry is pending', async () => {
    mocks.api.exportBackup.mockRejectedValueOnce(new Error('Export failed'))
    await mount()
    await click('Экспортировать')
    let complete
    mocks.api.exportBackup.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await click('Повторить действие')
    expect(button('Экспортировать').disabled).toBe(true)
    expect(button('Восстановить').disabled).toBe(true)
    await act(async () => { complete({ canceled: false }) })
    expect(mocks.api.exportBackup).toHaveBeenCalledTimes(2)
    expect(button('Экспортировать').disabled).toBe(false)
  })

  it('hides third-party media download controls for the local-only build', async () => {
    await mount()
    expect(host.textContent).toContain('Ранее сохранённые изображения доступны. Эта версия не скачивает сторонние анимации.')
    expect(host.textContent).toContain('Локальные файлы')
    expect([...host.querySelectorAll('button')].some(node => /Скачать медиа|Продолжить загрузку|Приостановить/.test(node.textContent))).toBe(false)
    expect(mocks.api.downloadMedia).not.toHaveBeenCalled()
    expect(mocks.api.pauseMedia).not.toHaveBeenCalled()
  })
})
