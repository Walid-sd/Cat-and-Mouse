import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const blocks = [...source.matchAll(/\{\n\s*id:\s*(\d+),[\s\S]*?\n\s*\},(?=\n\s*\{\n\s*id:|\n\s*\],\n\nexport function key)/g)]

if (blocks.length === 0) {
  console.error('Could not locate level definitions.')
  process.exit(1)
}

const levels = blocks.map((match, index) => {
  const block = match[0]
  const id = Number(match[1])
  const gridMatch = block.match(/grid:\s*\[([\s\S]*?)\],\n\s*mouseStart/)
  const mouseMatch = block.match(/mouseStart:\{row:(\d+),col:(\d+)\}/)
  const catMatch = block.match(/catStart:\{row:(\d+),col:(\d+)\}/)
  const exitMatch = block.match(/exit:\{row:(\d+),col:(\d+)\}/)
  if (!gridMatch || !mouseMatch || !catMatch || !exitMatch) throw new Error(`Level ${id || index + 1}: incomplete definition`)

  const grid = [...gridMatch[1].matchAll(/'([^']*)'/g)].map(m => m[1])
  const mouseStart = { row: Number(mouseMatch[1]), col: Number(mouseMatch[2]) }
  const catStart = { row: Number(catMatch[1]), col: Number(catMatch[2]) }
  const exit = { row: Number(exitMatch[1]), col: Number(exitMatch[2]) }
  const gateSection = block.match(/gates:\[([\s\S]*?)\],\n\s*riddles/)
  const gates = gateSection ? [...gateSection[1].matchAll(/\{row:(\d+),col:(\d+)\}/g)].map(m => ({ row: Number(m[1]), col: Number(m[2]) })) : []
  return { id, grid, mouseStart, catStart, exit, gates }
})

const directions = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }]
const key = p => `${p.row}:${p.col}`
const inside = (level, p) => p.row >= 0 && p.row < level.grid.length && p.col >= 0 && p.col < level.grid[0].length

function shortestPath(level, from, to, unlocked) {
  if (key(from) === key(to)) return [from]
  const queue = [from]
  const previous = new Map([[key(from), null]])
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col }
      if (!inside(level, next)) continue
      const cell = level.grid[next.row][next.col]
      if (cell === '#' || (cell === 'G' && !unlocked.has(key(next))) || previous.has(key(next))) continue
      previous.set(key(next), key(current))
      queue.push(next)
      if (key(next) === key(to)) {
        const route = [next]
        let parent = previous.get(key(next))
        while (parent) {
          const [row, col] = parent.split(':').map(Number)
          route.unshift({ row, col })
          parent = previous.get(parent) ?? null
        }
        return route
      }
    }
  }
  return []
}

function legalNeighbors(level, point, unlocked) {
  return directions
    .map(d => ({ row: point.row + d.row, col: point.col + d.col }))
    .filter(next => inside(level, next))
    .filter(next => level.grid[next.row][next.col] !== '#')
    .filter(next => level.grid[next.row][next.col] !== 'G' || unlocked.has(key(next)))
}

function validateRoute(level, route, from, to, unlocked, label) {
  if (!route.length) return `${label} returned no route`
  if (key(route[0]) !== key(from)) return `${label} has the wrong starting tile`
  if (key(route[route.length - 1]) !== key(to)) return `${label} has the wrong destination tile`
  for (let i = 0; i < route.length; i += 1) {
    const point = route[i]
    if (!inside(level, point)) return `${label} leaves the grid at ${key(point)}`
    const cell = level.grid[point.row][point.col]
    if (cell === '#' || (cell === 'G' && !unlocked.has(key(point)))) return `${label} enters blocked tile ${key(point)}`
    if (i > 0) {
      const previous = route[i - 1]
      const distance = Math.abs(point.row - previous.row) + Math.abs(point.col - previous.col)
      if (distance !== 1) return `${label} jumps from ${key(previous)} to ${key(point)}`
    }
  }
  return null
}

const failures = []
for (const level of levels) {
  const allUnlocked = new Set(level.gates.map(key))
  const locked = new Set()
  const starts = [
    ['mouse', level.mouseStart],
    ['cat', level.catStart],
    ['exit', level.exit],
  ]

  for (const [name, point] of starts) {
    if (!inside(level, point)) failures.push(`Level ${level.id}: ${name} is out of bounds`)
    else if (level.grid[point.row][point.col] === '#') failures.push(`Level ${level.id}: ${name} is inside a wall`)
  }
  if (key(level.mouseStart) === key(level.catStart)) failures.push(`Level ${level.id}: mouse and cat share a start tile`)

  const lockedEscapeRoute = shortestPath(level, level.mouseStart, level.exit, locked)
  const escapeRoute = shortestPath(level, level.mouseStart, level.exit, allUnlocked)
  if (!escapeRoute.length) failures.push(`Level ${level.id}: mouse cannot reach exit with gates unlocked`)
  else {
    const routeError = validateRoute(level, escapeRoute, level.mouseStart, level.exit, allUnlocked, `Level ${level.id} escape route`)
    if (routeError) failures.push(routeError)
  }

  if (level.id < 3 && !lockedEscapeRoute.length) failures.push(`Level ${level.id}: escape route is unexpectedly dependent on a gate`)
  if (level.id === 3 && lockedEscapeRoute.length) failures.push('Level 3: escape route is unexpectedly possible with all gates locked')

  const hunterRoute = shortestPath(level, level.catStart, level.mouseStart, allUnlocked)
  if (!hunterRoute.length) failures.push(`Level ${level.id}: cat cannot reach mouse with gates unlocked`)
  else {
    const routeError = validateRoute(level, hunterRoute, level.catStart, level.mouseStart, allUnlocked, `Level ${level.id} hunter route`)
    if (routeError) failures.push(routeError)
  }

  for (const gate of level.gates) {
    if (!inside(level, gate) || level.grid[gate.row]?.[gate.col] !== 'G') {
      failures.push(`Level ${level.id}: gate ${key(gate)} is not a G tile`)
    }
    if (shortestPath(level, level.mouseStart, gate, locked).length > 0) {
      failures.push(`Level ${level.id}: locked gate ${key(gate)} is incorrectly traversable`)
    }
    if (shortestPath(level, level.mouseStart, gate, new Set([key(gate)])).length === 0) {
      failures.push(`Level ${level.id}: gate ${key(gate)} is not reachable when unlocked`)
    }
  }

  if (escapeRoute.length && level.gates.length) {
    const routeKeys = new Set(escapeRoute.map(key))
    const optional = level.gates.filter(gate => !routeKeys.has(key(gate)))
    if (optional.length) console.warn(`Level ${level.id}: ${optional.length} gate(s) are not on the shortest fully-unlocked escape route; this is allowed.`)
  }

  const mouseMoves = legalNeighbors(level, level.mouseStart, allUnlocked)
  const catMoves = legalNeighbors(level, level.catStart, allUnlocked)
  if (!mouseMoves.length) failures.push(`Level ${level.id}: mouse has no legal opening move`)
  if (!catMoves.length) failures.push(`Level ${level.id}: cat has no legal opening move`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Gameplay smoke test passed for ${levels.length} levels: starts, routes, route integrity, gates, and opening moves are valid.`)
