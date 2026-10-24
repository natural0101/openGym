const fs = require('node:fs/promises')
const path = require('node:path')
// Public desktop builds never download artwork with unresolved distribution
// rights. Existing local files remain available and are never rewritten.
function createMedia(dir, manifest, notify) {
  let status = { state: 'local-only', downloadsEnabled: false, completed: 0, total: manifest.length, errors: 0 }
  const dest = item => path.join(dir, item.kind, item.name)
  const valid = async item => { try { return (await fs.stat(dest(item))).size > 20 } catch { return false } }
  const inspect = async () => {
    const present = await Promise.all(manifest.map(valid))
    const completed = present.filter(Boolean).length
    status = { ...status, completed }
    notify(status)
    return status
  }
  const start = async () => {
    throw new Error('Эта версия не скачивает сторонние изображения и анимации упражнений.')
  }
  return { inspect, start, stop: () => status, status: () => status }
}
module.exports = { createMedia }
