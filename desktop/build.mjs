import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { EXDB } from '../frontend/src/lib/exercises-data.js'
const result = spawnSync(process.execPath, ['frontend/node_modules/vite/bin/vite.js', 'build', 'frontend'], {
  stdio: 'inherit', env: { ...process.env, VITE_DESKTOP: '1' }
})
if (result.status !== 0) process.exit(result.status ?? 1)
const manifest = [...new Map(EXDB.flatMap(ex => ['img', 'gif'].filter(kind => ex[kind]).map(kind => [`${kind}/${ex[kind]}`, { kind, name: ex[kind] }]))).values()]
writeFileSync('frontend/dist/desktop-media.json', JSON.stringify(manifest))
