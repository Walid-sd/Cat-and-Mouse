import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/game.ts', import.meta.url), 'utf8')
const grids = [...source.matchAll(/grid:\s*\[([\s\S]*?)\],\s*mouseStart:/g)]

if (!grids.length) throw new Error('No level grids found')
for (let i = 0; i < grids.length; i += 1) {
  const rows = [...grids[i][1].matchAll(/['\"]([^'\"]*)['\"]/g)].map((m) => m[1])
  if (rows.length !== 15 || rows.some((row) => row.length !== 15)) {
    throw new Error(`Level ${i + 1} is not 15x15`)
  }
}
console.log(`Validated ${grids.length} level grids.`)
