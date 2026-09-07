import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const gridMatches = [...source.matchAll(/grid:\s*\[([\s\S]*?)\],\n\s*mouseStart/g)]
const errors = []

for (let i = 0; i < gridMatches.length; i += 1) {
  const rows = [...gridMatches[i][1].matchAll(/'([^']*)'/g)].map(match => match[1])
  if (!rows.length) {
    errors.push(`Level ${i + 1}: empty grid`)
    continue
  }
  const width = rows[0].length
  if (rows.some(row => row.length !== width)) errors.push(`Level ${i + 1}: inconsistent row width`)
  if (!rows.every(row => row.includes('#'))) errors.push(`Level ${i + 1}: malformed wall data`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${gridMatches.length} level definitions.`)
