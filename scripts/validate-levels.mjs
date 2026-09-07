import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const blocks = [...source.matchAll(/\{\s*id:\s*(\d+),[\s\S]*?\n\s*\},(?=\n\s*\{\s*id:|\n\s*\],\n\nexport function key)/g)]
const errors = []

if (!blocks.length) {
  console.error('No level definitions found.')
  process.exit(1)
}

const ids = blocks.map(match => Number(match[1]))
if (new Set(ids).size !== ids.length) errors.push('Duplicate level id detected.')

const parseGrid = (block, field) => {
  const match = block.match(new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\],\\n\\s*(?:huntGrid|mouseStart)`))
  return match ? [...match[1].matchAll(/'([^']*)'/g)].map(item => item[1]) : null
}

for (const blockMatch of blocks) {
  const block = blockMatch[0]
  const levelNumber = Number(blockMatch[1])
  const variants = [
    ['Escape', parseGrid(block, 'grid')],
    ['Hunt', parseGrid(block, 'huntGrid')],
  ]

  const gatesMatch = block.match(/gates:\s*\[([\s\S]*?)\],\n\s*riddles:/)
  const gateCount = gatesMatch ? (gatesMatch[1].match(/\{row:/g) ?? []).length : -1
  const riddleCount = (block.match(/riddle\(/g) ?? []).length
  if (gateCount < 0) errors.push(`Level ${levelNumber}: gates definition not found`)
  if (gateCount >= 0 && gateCount !== riddleCount) errors.push(`Level ${levelNumber}: ${gateCount} gates but ${riddleCount} riddles`)

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
    const gateCountInGrid = text.split('G').length - 1
    if (gateCount >= 0 && gateCountInGrid !== gateCount) errors.push(`Level ${levelNumber} ${variantName}: grid has ${gateCountInGrid} gates but gates array has ${gateCount}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Validated ${blocks.length} levels across Escape and Hunt maze layouts.`)
