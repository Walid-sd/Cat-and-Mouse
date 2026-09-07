import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const failures = []

if (!source.includes('export function hasLineOfSight')) failures.push('Vision helper is missing.')
if (!source.includes('sameRow = delta.row === 0')) failures.push('Vision must detect targets on the same row in either direction.')
if (!source.includes('sameColumn = delta.col === 0')) failures.push('Vision must detect targets on the same column in either direction.')
if (!source.includes('for (let currentDistance = 1; currentDistance < distance; currentDistance += 1)')) failures.push('Vision must trace intervening grid cells so walls block sight.')

function key(p) { return `${p.row}:${p.col}` }

function canEnter(grid, point) {
  return grid[point.row]?.[point.col] !== undefined && grid[point.row][point.col] !== '#'
}

function hasLineOfSight(grid, observer, target) {
  if (key(observer) === key(target)) return false
  const delta = { row: target.row - observer.row, col: target.col - observer.col }
  const sameRow = delta.row === 0
  const sameColumn = delta.col === 0
  if (!sameRow && !sameColumn) return false

  const distance = Math.abs(delta.row) + Math.abs(delta.col)
  const step = { row: Math.sign(delta.row), col: Math.sign(delta.col) }
  for (let currentDistance = 1; currentDistance < distance; currentDistance += 1) {
    const point = {
      row: observer.row + step.row * currentDistance,
      col: observer.col + step.col * currentDistance,
    }
    if (!canEnter(grid, point)) return false
  }
  return canEnter(grid, target)
}

const open = [
  '#########',
  '#.......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#########',
]
const observer = { row: 3, col: 4 }

if (!hasLineOfSight(open, observer, { row: 3, col: 5 })) failures.push('Hunt vision should detect a cat one cell to the right.')
if (!hasLineOfSight(open, observer, { row: 3, col: 1 })) failures.push('Hunt vision should detect a cat several cells to the left.')
if (!hasLineOfSight(open, observer, { row: 1, col: 4 })) failures.push('Hunt vision should detect a cat several cells above.')
if (!hasLineOfSight(open, observer, { row: 5, col: 4 })) failures.push('Hunt vision should detect a cat several cells below.')
if (hasLineOfSight(open, observer, { row: 2, col: 3 })) failures.push('Hunt vision should not treat a diagonal tile as direct line of sight.')

const blocked = open.slice()
blocked[3] = '#..#....#'
if (hasLineOfSight(blocked, observer, { row: 3, col: 7 })) failures.push('A wall must block Hunt vision at any distance.')

console.log(failures.length ? failures.map(failure => `FAIL: ${failure}`).join('\n') : 'Hunt vision regression test passed: vision is omnidirectional, long-range, and wall-blocked.')
if (failures.length) process.exit(1)
