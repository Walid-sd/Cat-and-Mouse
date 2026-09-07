import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const levelBlocks = [...source.matchAll(/\{\s*id:\s*(\d+),[\s\S]*?(?=\n\s*\},\n\s*(?:\{|\]))/g)]
const errors = []

if (!levelBlocks.length) {
  console.error('No level definitions found.')
  process.exit(1)
}

const ids = levelBlocks.map(match => Number(match[1]))
if (new Set(ids).size !== ids.length) errors.push('Duplicate level id detected.')

const parseGrid = (block, field) => {
  const match = block.match(new RegExp(`${field}:\\s*\[([\\s\\S]*?)\]`))
  return match ? [...match[1].matchAll(/'([^']*)'/g)].map(item => item[1]) : null
}

for (const levelMatch of levelBlocks) {
  const block = levelMatch[0]
  const levelNumber = Number(levelMatch[1])
  const variants = [
    ['Escape', parseGrid(block, 'grid')],
    ['Hunt', parseGrid(block, 'huntGrid')],
  ]

  const gatesMatch = block.match(/gates:\s*\[([\s\S]*?)\],\s*riddles:/)
  const gateCount = gatesMatch ? (gatesMatch[1].match(/\{row:/g) ?? []).length : -1
  const riddleArrayMatch = block.match(/riddles:\s*\[([\s\S]*?)\],\s*huntGrid:/)
  const riddleCount = riddleArrayMatch ? (riddleArrayMatch[1].match(/riddle\(/g) ?? []).length : -1

  if (gateCount < 0) errors.push(`Level ${levelNumber}: gates definition not found`)
  if (riddleCount < 0) errors.push(`Level ${levelNumber}: riddles definition not found`)
  if (gateCount >= 0 && riddleCount >= 0 && gateCount !== riddleCount) errors.push(`Level ${levelNumber}: ${gateCount} gates but ${riddleCount} riddles`)

  for (const [variantName, rows] of variants) {
    if (!rows?.length) {
      errors.push(`Level ${levelNumber} ${variantName}: empty grid`)
      continue
    }

    const width = rows[0].length
    if (!width) errors.push(`Level ${levelNumber} ${variantName}: zero-width grid`)
    if (rows.some(row => row.length !== width)) errors.push(`Level ${levelNumber} ${variantName}: inconsistent row width`)
    if (rows.some(row => !/^[#MCEG.]+$/.test(row))) errors.push(`Level ${levelNumber} ${variantName}: invalid maze character`)
    if (rows.some(row => !row.startsWith('#') || !row.endsWith('#'))) errors.push(`Level ${levelNumber} ${variantName}: maze boundary is not walled`)

    const text = rows.join('')
    for (const marker of ['M', 'C', 'E']) {
      const count = text.split(marker).length - 1
      if (count !== 1) errors.push(`Level ${levelNumber} ${variantName}: expected exactly one ${marker}, found ${count}`)
    }
    const gridGateCount = text.split('G').length - 1
    if (gateCount >= 0 && gridGateCount !== gateCount) errors.push(`Level ${levelNumber} ${variantName}: grid has ${gridGateCount} gates but gates array has ${gateCount}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${levelBlocks.length} levels across Escape and Hunt maze layouts.`)
