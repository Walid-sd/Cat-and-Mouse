import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const levelMatches = [...source.matchAll(/\{\n\s*id:\s*(\d+),[\s\S]*?\n\s*\},(?=\n\s*\{\n\s*id:|\n\s*\],\n\})/g)]
const gridMatches = [...source.matchAll(/grid:\s*\[([\s\S]*?)\],\n\s*mouseStart/g)]
const errors = []

if (!gridMatches.length) errors.push('No level grids found.')

const seenIds = new Set()

for (let i = 0; i < gridMatches.length; i += 1) {
  const rows = [...gridMatches[i][1].matchAll(/'([^']*)'/g)].map(match => match[1])
  const levelNumber = i + 1

  if (!rows.length) {
    errors.push(`Level ${levelNumber}: empty grid`)
    continue
  }

  const width = rows[0].length
  if (!width) errors.push(`Level ${levelNumber}: zero-width grid`)
  if (rows.some(row => row.length !== width)) errors.push(`Level ${levelNumber}: inconsistent row width`)
  if (rows.some(row => !/^[#MCEG.]+$/.test(row))) errors.push(`Level ${levelNumber}: invalid maze character`)
  if (rows.some(row => !row.startsWith('#') || !row.endsWith('#'))) errors.push(`Level ${levelNumber}: maze boundary is not walled`)
  if (rows[0]?.length !== rows.at(-1)?.length) errors.push(`Level ${levelNumber}: top/bottom boundary width mismatch`)

  const counts = Object.fromEntries(['M', 'C', 'E', 'G'].map(char => [char, rows.join('').split(char).length - 1]))
  for (const marker of ['M', 'C', 'E']) {
    if (counts[marker] !== 1) errors.push(`Level ${levelNumber}: expected exactly one ${marker}, found ${counts[marker]}`)
  }

  const blockStart = source.lastIndexOf('{', gridMatches[i].index ?? 0)
  const blockEnd = source.indexOf('\n  },', gridMatches[i].index ?? 0)
  const block = source.slice(blockStart, blockEnd < 0 ? source.length : blockEnd)
  const idMatch = block.match(/id:\s*(\d+)/)
  const id = idMatch ? Number(idMatch[1]) : levelNumber

  if (seenIds.has(id)) errors.push(`Level ${levelNumber}: duplicate level id ${id}`)
  seenIds.add(id)

  const gatesMatch = block.match(/gates:\s*\[([\s\S]*?)\],\n\s*riddles:/)
  const gateCount = gatesMatch ? (gatesMatch[1].match(/\{row:/g) ?? []).length : -1
  const riddleCount = (block.match(/riddle\(/g) ?? []).length

  if (gateCount < 0) errors.push(`Level ${levelNumber}: gates definition not found`)
  else {
    if (gateCount !== counts.G) errors.push(`Level ${levelNumber}: grid has ${counts.G} gates but gates array has ${gateCount}`)
    if (gateCount !== riddleCount) errors.push(`Level ${levelNumber}: ${gateCount} gates but ${riddleCount} riddles`)
  }
}

if (levelMatches.length && levelMatches.length !== gridMatches.length) {
  errors.push(`Level definition count mismatch: found ${gridMatches.length} grids and ${levelMatches.length} level blocks.`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${gridMatches.length} level definitions.`)
