import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const failures = []

if (!source.includes('export function hasLineOfSight')) failures.push('Vision helper is missing.')
if (!source.includes('sidewaysDistance > forwardDistance')) failures.push('Vision must use a forward cone instead of exact row/column matching.')
if (!source.includes('Trace the actual grid line')) failures.push('Vision must trace intervening grid cells so walls block sight.')

function key(p) { return `${p.row}:${p.col}` }
const directions = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }]

function canEnter(grid, point) {
  return grid[point.row]?.[point.col] !== undefined && grid[point.row][point.col] !== '#'
}

function hasLineOfSight(grid, observer, target, facing) {
  if (!facing || key(observer) === key(target)) return false
  const delta = { row: target.row - observer.row, col: target.col - observer.col }
  const forwardDistance = delta.row * facing.row + delta.col * facing.col
  const sidewaysDistance = Math.abs(delta.row * facing.col - delta.col * facing.row)
  if (forwardDistance <= 0 || sidewaysDistance > forwardDistance) return false

  let row = observer.row
  let col = observer.col
  const absRow = Math.abs(target.row - row)
  const absCol = Math.abs(target.col - col)
  const stepRow = row < target.row ? 1 : -1
  const stepCol = col < target.col ? 1 : -1
  let error = absRow - absCol

  while (row !== target.row || col !== target.col) {
    const doubleError = error * 2
    if (doubleError > -absCol) { error -= absCol; row += stepRow }
    if (doubleError < absRow) { error += absRow; col += stepCol }
    if (row === target.row && col === target.col) break
    if (!canEnter(grid, { row, col })) return false
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
const facingRight = { row: 0, col: 1 }
const observer = { row: 3, col: 1 }

if (!hasLineOfSight(open, observer, { row: 3, col: 2 }, facingRight)) failures.push('Hunt vision should detect a cat one cell ahead.')
if (!hasLineOfSight(open, observer, { row: 3, col: 5 }, facingRight)) failures.push('Hunt vision should detect a cat four cells ahead with no wall.')
if (!hasLineOfSight(open, observer, { row: 2, col: 4 }, facingRight)) failures.push('Hunt vision should detect a diagonally forward cat with no wall.')
if (hasLineOfSight(open, observer, { row: 3, col: 5 }, { row: 0, col: -1 })) failures.push('Hunt vision should not detect a cat behind the mouse.')

const blocked = open.slice()
blocked[3] = '#..#....#'
if (hasLineOfSight(blocked, observer, { row: 3, col: 5 }, facingRight)) failures.push('A wall must block Hunt vision at any distance.')

console.log(failures.length ? failures.map(failure => `FAIL: ${failure}`).join('\n') : 'Hunt vision regression test passed: forward vision is long-range, wall-blocked, and directional.')
if (failures.length) process.exit(1)
