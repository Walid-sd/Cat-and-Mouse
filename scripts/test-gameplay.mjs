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

// Searches the actual Escape turn model: a player may unlock an adjacent gate
// without spending a turn, then each successful move advances the cat one BFS step.
// This proves every level has at least one genuinely playable winning strategy.
function canEscape(level) {
  const start = { mouse: level.mouseStart, cat: level.catStart, unlocked: new Set() }
  const queue = [start]
  const seen = new Set([`${key(start.mouse)}|${key(start.cat)}|`])

  for (let i = 0; i < queue.length; i += 1) {
    const state = queue[i]
    const unlockedKey = [...state.unlocked].sort().join(',')

    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (state.unlocked.has(gateKey)) continue
      if (Math.abs(gate.row - state.mouse.row) + Math.abs(gate.col - state.mouse.col) !== 1) continue
      const nextUnlocked = new Set(state.unlocked)
      nextUnlocked.add(gateKey)
      const nextKey = `${key(state.mouse)}|${key(state.cat)}|${[...nextUnlocked].sort().join(',')}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ mouse: state.mouse, cat: state.cat, unlocked: nextUnlocked })
      }
    }

    for (const nextMouse of legalNeighbors(level, state.mouse, state.unlocked)) {
      if (key(nextMouse) === key(state.cat)) continue
      if (key(nextMouse) === key(level.exit)) return true

      const route = shortestPath(level, state.cat, nextMouse, state.unlocked)
      const nextCat = route.length > 1 ? route[1] : state.cat
      if (key(nextCat) === key(nextMouse)) continue

      const nextKey = `${key(nextMouse)}|${key(nextCat)}|${unlockedKey}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ mouse: nextMouse, cat: nextCat, unlocked: new Set(state.unlocked) })
      }
    }
  }

  return false
}

// Mirrors App.tsx's deterministic Hunt mouse AI exactly. The solver asks whether
// at least one cat move can eventually force a catch against that fixed response.
function mouseTurn(level, currentCat, currentMouse, unlocked) {
  const options = legalNeighbors(level, currentMouse, unlocked).filter(p => key(p) !== key(currentCat))
  if (!options.length) return null

  let best = options[0]
  let bestScore = -Infinity
  for (const option of options) {
    const distance = shortestPath(level, currentCat, option, unlocked).length
    const exitDistance = shortestPath(level, option, level.exit, unlocked).length
    const score = distance * 4 - exitDistance
    if (score > bestScore) {
      bestScore = score
      best = option
    }
  }
  return best
}

function canHunt(level) {
  const start = { cat: level.catStart, mouse: level.mouseStart, unlocked: new Set() }
  const queue = [start]
  const seen = new Set([`${key(start.cat)}|${key(start.mouse)}|`])

  for (let i = 0; i < queue.length; i += 1) {
    const state = queue[i]
    const unlockedKey = [...state.unlocked].sort().join(',')

    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (state.unlocked.has(gateKey)) continue
      if (Math.abs(gate.row - state.cat.row) + Math.abs(gate.col - state.cat.col) !== 1) continue
      const nextUnlocked = new Set(state.unlocked)
      nextUnlocked.add(gateKey)
      const nextKey = `${key(state.cat)}|${key(state.mouse)}|${[...nextUnlocked].sort().join(',')}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ cat: state.cat, mouse: state.mouse, unlocked: nextUnlocked })
      }
    }

    for (const nextCat of legalNeighbors(level, state.cat, state.unlocked)) {
      if (key(nextCat) === key(state.mouse)) return true

      const fleeing = mouseTurn(level, nextCat, state.mouse, state.unlocked)
      if (!fleeing) return true
      if (key(fleeing) === key(nextCat)) return true
      if (key(fleeing) === key(level.exit)) continue

      const nextKey = `${key(nextCat)}|${key(fleeing)}|${unlockedKey}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ cat: nextCat, mouse: fleeing, unlocked: new Set(state.unlocked) })
      }
    }
  }

  return false
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

  if (!canEscape(level)) failures.push(`Level ${level.id}: no winning Escape strategy survives the cat's BFS response`)
  if (!canHunt(level)) failures.push(`Level ${level.id}: no winning Hunt strategy catches the mouse before it escapes`)

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

console.log(`Gameplay smoke test passed for ${levels.length} levels: starts, routes, route integrity, gates, opening moves, Escape solvability, and Hunt solvability are valid.`)
