import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
if (source.includes('activeMode') || source.includes('setActiveMode')) {
  console.error('Gameplay engine must not use global active mode state.')
  process.exit(1)
}
if (!source.includes('export function gridForMode')) {
  console.error('Gameplay engine must expose explicit gridForMode mode selection.')
  process.exit(1)
}

const blocks = [...source.matchAll(/\{\n\s*id:\s*(\d+),[\s\S]*?(?=\n\s*\},\n\s*\{\n\s*id:|\n\s*\},\n\]\n\nexport function gridForMode)/g)]

if (!blocks.length) {
  console.error('Could not locate level definitions.')
  process.exit(1)
}

function parseRows(block, property) {
  const match = block.match(new RegExp(`${property}:\\s*\[([\\s\\S]*?)\\]`))
  if (!match) throw new Error(`Missing ${property}`)
  return [...match[1].matchAll(/'([^']*)'/g)].map(m => m[1])
}

const levels = blocks.map((match, index) => {
  const block = match[0]
  const id = Number(match[1])
  const grid = parseRows(block, 'grid')
  const huntGrid = parseRows(block, 'huntGrid')
  const point = name => {
    const match = block.match(new RegExp(`${name}:\\{row:(\\d+),col:(\\d+)\\}`))
    if (!match) throw new Error(`Level ${id || index + 1}: missing ${name}`)
    return { row: Number(match[1]), col: Number(match[2]) }
  }
  const gateSection = block.match(/gates:\[([\s\S]*?)\],\n\s*riddles/)
  const gates = gateSection ? [...gateSection[1].matchAll(/\{row:(\d+),col:(\d+)\}/g)].map(m => ({ row: Number(m[1]), col: Number(m[2]) })) : []
  return { id, grid, huntGrid, mouseStart: point('mouseStart'), catStart: point('catStart'), exit: point('exit'), gates }
})

const directions = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }]
const key = p => `${p.row}:${p.col}`

function inside(level, p) {
  return p.row >= 0 && p.row < level.grid.length && p.col >= 0 && p.col < level.grid[0].length
}

function shortestPath(level, from, to, unlocked) {
  if (key(from) === key(to)) return [from]
  const queue = [from]
  const previous = new Map([[key(from), null]])
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    for (const d of directions) {
      const next = { row: current.row + d.row, col: current.col + d.col }
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
    .filter(p => inside(level, p))
    .filter(p => level.grid[p.row][p.col] !== '#')
    .filter(p => level.grid[p.row][p.col] !== 'G' || unlocked.has(key(p)))
}

function mouseTurn(level, currentCat, currentMouse, unlocked, lastMouse) {
  const options = legalNeighbors(level, currentMouse, unlocked).filter(p => key(p) !== key(currentCat))
  if (!options.length) return null
  const catOptions = legalNeighbors(level, currentCat, unlocked).filter(p => key(p) !== key(currentMouse))
  const previousKey = lastMouse ? key(lastMouse) : null
  let best = options[0]
  let bestScore = -Infinity

  for (const option of options) {
    const distance = shortestPath(level, currentCat, option, unlocked).length
    const exitPath = shortestPath(level, option, level.exit, unlocked)
    const exitDistance = exitPath.length ? exitPath.length - 1 : 999
    const mobility = legalNeighbors(level, option, unlocked).filter(p => key(p) !== key(currentCat)).length
    const reversePenalty = previousKey === key(option) ? 7 : 0
    let worstCaseDistance = distance ? distance - 1 : 999
    if (catOptions.length) {
      worstCaseDistance = Math.min(...catOptions.map(catOption => {
        const path = shortestPath(level, catOption, option, unlocked)
        return path.length ? path.length - 1 : 999
      }))
    }
    const score = distance * 8 + worstCaseDistance * 5 - exitDistance * 2 + mobility * 2 - reversePenalty
    if (score > bestScore) {
      bestScore = score
      best = option
    }
  }
  return best
}

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
      const nextUnlocked = new Set(state.unlocked).add(gateKey)
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

function canHunt(level) {
  const start = { cat: level.catStart, mouse: level.mouseStart, lastMouse: null, unlocked: new Set() }
  const queue = [start]
  const seen = new Set([`${key(start.cat)}|${key(start.mouse)}||`])
  for (let i = 0; i < queue.length; i += 1) {
    const state = queue[i]
    const unlockedKey = [...state.unlocked].sort().join(',')
    const lastMouseKey = state.lastMouse ? key(state.lastMouse) : ''
    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (state.unlocked.has(gateKey)) continue
      if (Math.abs(gate.row - state.cat.row) + Math.abs(gate.col - state.cat.col) !== 1) continue
      const nextUnlocked = new Set(state.unlocked).add(gateKey)
      const nextKey = `${key(state.cat)}|${key(state.mouse)}|${lastMouseKey}|${[...nextUnlocked].sort().join(',')}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ cat: state.cat, mouse: state.mouse, lastMouse: state.lastMouse, unlocked: nextUnlocked })
      }
    }
    for (const nextCat of legalNeighbors(level, state.cat, state.unlocked)) {
      if (key(nextCat) === key(state.mouse)) return true
      const fleeing = mouseTurn(level, nextCat, state.mouse, state.unlocked, state.lastMouse)
      if (!fleeing || key(fleeing) === key(nextCat)) return true
      if (key(fleeing) === key(level.exit)) continue
      const nextKey = `${key(nextCat)}|${key(fleeing)}|${key(state.mouse)}|${unlockedKey}`
      if (!seen.has(nextKey)) {
        seen.add(nextKey)
        queue.push({ cat: nextCat, mouse: fleeing, lastMouse: state.mouse, unlocked: new Set(state.unlocked) })
      }
    }
  }
  return false
}

function testVariant(base, variant, label) {
  const level = { ...base, grid: variant }
  const allUnlocked = new Set(level.gates.map(key))
  const starts = [['mouse', level.mouseStart], ['cat', level.catStart], ['exit', level.exit]]
  const failures = []

  if (!level.grid.length || level.grid.some(row => row.length !== level.grid[0].length)) failures.push(`${label}: inconsistent grid dimensions`)
  for (const [name, point] of starts) {
    if (!inside(level, point)) failures.push(`${label}: ${name} is out of bounds`)
    else if (level.grid[point.row][point.col] === '#') failures.push(`${label}: ${name} is inside a wall`)
  }
  if (key(level.mouseStart) === key(level.catStart)) failures.push(`${label}: mouse and cat share a start tile`)

  const escapeRoute = shortestPath(level, level.mouseStart, level.exit, allUnlocked)
  if (!escapeRoute.length) failures.push(`${label}: mouse cannot reach exit with gates unlocked`)
  const hunterRoute = shortestPath(level, level.catStart, level.mouseStart, allUnlocked)
  if (!hunterRoute.length) failures.push(`${label}: cat cannot reach mouse with gates unlocked`)

  for (const gate of level.gates) {
    const gateKey = key(gate)
    if (!inside(level, gate) || level.grid[gate.row]?.[gate.col] !== 'G') failures.push(`${label}: gate ${gateKey} is not a G tile`)
    if (shortestPath(level, level.mouseStart, gate, new Set()).length) failures.push(`${label}: locked gate ${gateKey} is incorrectly traversable from mouse start`)
    if (!shortestPath(level, level.mouseStart, gate, new Set([gateKey])).length) failures.push(`${label}: gate ${gateKey} is not reachable when unlocked`)
  }

  const mouseMoves = legalNeighbors(level, level.mouseStart, allUnlocked)
  const catMoves = legalNeighbors(level, level.catStart, allUnlocked)
  if (!mouseMoves.length) failures.push(`${label}: mouse has no legal opening move`)
  if (!catMoves.length) failures.push(`${label}: cat has no legal opening move`)
  return failures
}

const failures = []
for (const base of levels) {
  failures.push(...testVariant(base, base.grid, `Level ${base.id} Escape layout`))
  failures.push(...testVariant(base, base.huntGrid, `Level ${base.id} Hunt layout`))
  if (!canEscape({ ...base, grid: base.grid })) failures.push(`Level ${base.id}: no winning Escape strategy survives the cat's BFS response`)
  if (!canHunt({ ...base, grid: base.huntGrid })) failures.push(`Level ${base.id}: no winning Hunt strategy catches the mouse before it escapes`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Gameplay smoke test passed for ${levels.length} levels: Escape and Hunt layouts, routes, gates, opening moves, and role-specific solvability are valid.`)
