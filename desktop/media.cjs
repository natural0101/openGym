const fs = require('node:fs/promises')
const path = require('node:path')
const REVISION = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const SOURCE = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${REVISION}`

function createMedia(dir, manifest, notify) {
  let running = false, controller
  let status = { state: 'missing', completed: 0, total: manifest.length, errors: 0 }
  const emit = patch => { status = { ...status, ...patch }; notify(status); return status }
  const dest = item => path.join(dir, item.kind, item.name)
  const valid = async item => { try { return (await fs.stat(dest(item))).size > 20 } catch { return false } }
  const inspect = async () => {
    if (running) return status
    const present = await Promise.all(manifest.map(valid))
    const completed = present.filter(Boolean).length
    return emit({ completed, state: completed === manifest.length ? 'ready' : 'missing' })
  }
  const start = async () => {
    if (running) return status
    running = true
    controller = new AbortController()
    emit({ state: 'downloading', errors: 0 })
    try {
      await fs.mkdir(path.join(dir, 'img'), { recursive: true })
      await fs.mkdir(path.join(dir, 'gif'), { recursive: true })
      const present = await Promise.all(manifest.map(valid))
      const pending = manifest.filter((_, i) => !present[i])
      emit({ completed: present.filter(Boolean).length })
      let cursor = 0
      await Promise.all(Array.from({ length: 10 }, async () => {
        while (cursor < pending.length && !controller.signal.aborted) {
          const item = pending[cursor++]
          try {
            const response = await fetch(`${SOURCE}/${item.kind === 'img' ? 'images' : 'videos'}/${encodeURIComponent(item.name)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            if (Number(response.headers.get('content-length')) > 15 * 1024 * 1024) throw new Error('Media too large')
            const bytes = Buffer.from(await response.arrayBuffer())
            if (bytes.length < 20 || bytes.length > 15 * 1024 * 1024) throw new Error('Invalid media size')
            const image = item.kind === 'img' ? bytes[0] === 255 && bytes[1] === 216 : bytes.subarray(0, 3).toString() === 'GIF'
            if (!image) throw new Error('Invalid media format')
            await fs.writeFile(dest(item) + '.tmp', bytes)
            await fs.rename(dest(item) + '.tmp', dest(item))
            emit({ completed: status.completed + 1 })
          } catch { if (!controller.signal.aborted) emit({ errors: status.errors + 1 }) }
        }
      }))
      emit({ state: status.completed === manifest.length ? 'ready' : controller.signal.aborted ? 'paused' : 'error' })
    } catch (e) { emit({ state: 'error', message: e.message }) }
    finally { running = false }
    return status
  }
  return { inspect, start, stop: () => { controller?.abort(); return status }, status: () => status }
}
module.exports = { createMedia }
