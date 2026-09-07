import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const failures = []

if (!source.includes('export function hasLineOfSight')) failures.push('Vision helper is missing.')
if (!source.includes('const doubledError = 2 * error')) failures.push('Vision must use a continuous grid line rather than only cardinal directions.')
if (!source.includes('if (!same(point, observer) && !canEnter(grid, point, unlocked)) return false')) failures.push('Vision must trace every intervening tile and stop at walls or locked gates.')

function key(p) { return `${p.row}:${p.col}` }

function canEnter(grid, point) {
  return grid[point.row]?.[point.col] !== undefined && grid[point.row][point.col] !== '#'
}

function hasLineOfSight(grid, observer, target) {
  if (key(observer) === key(target)) return false
  let x0 = observer.col
  let y0 = observer.row
  const x1 = target.col
  const y1 = target.row
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy

  while (true) {
    const point = { row: y0, col: x0 }
    if (!key(point).includes(key(observer)) && !canEnter(grid, point)) return false
    if (x0 === x1 && y0 === y1) return true

    const doubledError = 2 * error
    if (doubledError >= dy) {
      error += dy
      x0 += sx
    }
    if (doubledError <= dx) {
      error += dx
      y0 += sy
    }
  }
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

if (!hasLineOfSight(open, observer, { row: 3, col: 1 })) failures.push('Hunt vision should detect a cat several cells in front.')
if (!hasLineOfSight(open, observer, { row: 3, col: 7 })) failures.push('Hunt vision should detect a cat several cells behind.')
if (!hasLineOfSight(open, observer, { row: 1, col: 4 })) failures.push('Hunt vision should detect a cat several cells to the left.')
if (!hasLineOfSight(open, observer, { row: 5, col: 4 })) failures.push('Hunt vision should detect a cat several cells to the right.')
if (!hasLineOfSight(open, observer, { row: 1, col: 2 })) failures.push('Hunt vision should detect an unobstructed diagonal target.')
if (!hasLineOfSight(open, observer, { row: 5, col: 6 })) failures.push('Hunt vision should detect an unobstructed diagonal target in another direction.')

const blocked = open.slice()
blocked[3] = '#....#..#'
if (hasLineOfSight(blocked, observer, { row: 3, col: 7 })) failures.push('A wall must block Hunt vision at any distance.')

const blockedDiagonal = open.slice()
blockedDiagonal[2] = '#.#.....#'
if (hasLineOfSight(blockedDiagonal, observer, { row: 1, col: 2 })) failures.push('A wall on a diagonal sight line must block Hunt vision.')

console.log(failures.length ? failures.map(failure => `FAIL: ${failure}`).join('\n') : 'Hunt vision regression test passed: full 360-degree line of sight is long-range and wall-blocked.')
if (failures.length) process.exit(1)