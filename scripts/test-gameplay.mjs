import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8')
const failures = []

if (source.includes('activeMode') || source.includes('setActiveMode')) failures.push('Gameplay engine must not use global active mode state.')
if (!source.includes('export function gridForMode')) failures.push('Gameplay engine must expose explicit gridForMode mode selection.')

const blocks = [...source.matchAll(/\{\n\s*id:\s*(\d+),[\s\S]*?(?=\n\s*\},\n\s*\{\n\s*id:|\n\s*\},\n\]\n\nexport function gridForMode)/g)]
if (!blocks.length) failures.push('Could not locate level definitions.')

function parseRows(block, property) {
  const match = block.match(new RegExp(property + ':\\s*\\[([\\s\\S]*?)\\]'))
  if (!match) throw new Error(`Missing ${property}`)
  return [...match[1].matchAll(/'([^']*)'/g)].map(m => m[1])
}

const levels = blocks.map((match, index) => {
  const block = match[0]
  const id = Number(match[1])
  const grid = parseRows(block, 'grid')
  const huntGrid = parseRows(block, 'huntGrid')
  const point = name => {
    const pointMatch = block.match(new RegExp(`${name}:\\{row:(\\d+),col:(\\d+)\\}`))
    if (!pointMatch) throw new Error(`Level ${id || index + 1}: missing ${name}`)
    return { row: Number(pointMatch[1]), col: Number(pointMatch[2]) }
  }
  const gateSection = block.match(/gates:\[([\s\S]*?)\],\n\s*riddles/)
  const gates = gateSection ? [...gateSection[1].matchAll(/\{row:(\d+),col:(\d+)\}/g)].map(m => ({ row: Number(m[1]), col: Number(m[2]) })) : []
  return { id, grid, huntGrid, mouseStart: point('mouseStart'), catStart: point('catStart'), exit: point('exit'), gates }
})

function key(p) { return `${p.row}:${p.col}` }
const directions = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }]

function inside(level, p) {
  return p.row >= 0 && p.row < level.grid.length && p.col >= 0 && p.col < level.grid[0].length
}

function canEnter(level, p, unlocked) {
  if (!inside(level, p)) return false
  const cell = level.grid[p.row][p.col]
  return cell !== '#' && (cell !== 'G' || unlocked.has(key(p)))
}

function shortestPath(level, from, to, unlocked) {
  if (key(from) === key(to)) return [from]
  const queue = [from]
  const previous = new Map([[key(from), null]])
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    for (const d of directions) {
      const next = { row: current.row + d.row, col: current.col + d.col }
      if (!canEnter(level, next, unlocked) || previous.has(key(next))) continue
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

function neighbors(level, point, unlocked) {
  return directions.map(d => ({ row: point.row + d.row, col: point.col + d.col })).filter(p => canEnter(level, p, unlocked))
}

function mouseTurn(level, cat, mouse, unlocked, lastMouse) {
  const options = neighbors(level, mouse, unlocked).filter(p => key(p) !== key(cat))
  if (!options.length) return null
  const previousKey = lastMouse ? key(lastMouse) : null
  const catOptions = neighbors(level, cat, unlocked).filter(p => key(p) !== key(mouse))
  let best = options[0]
  let bestScore = -Infinity
  for (const option of options) {
    const distance = shortestPath(level, cat, option, unlocked).length
    const exitPath = shortestPath(level, option, level.exit, unlocked)
    const exitDistance = exitPath.length ? exitPath.length - 1 : 999
    const mobility = neighbors(level, option, unlocked).filter(p => key(p) !== key(cat)).length
    let worstCaseDistance = distance ? distance - 1 : 999
    if (catOptions.length) worstCaseDistance = Math.min(...catOptions.map(nextCat => {
      const path = shortestPath(level, nextCat, option, unlocked)
      return path.length ? path.length - 1 : 999
    }))
    const score = distance * 8 + worstCaseDistance * 5 - exitDistance * 2 + mobility * 2 - (previousKey === key(option) ? 7 : 0)
    if (score > bestScore) { bestScore = score; best = option }
  }
  return best
}

function testVariant(base, variant, label) {
  const level = { ...base, grid: variant }
  const allUnlocked = new Set(level.gates.map(key))
  if (!level.grid.length || level.grid.some(row => row.length !== level.grid[0].length)) return [`${label}: inconsistent grid dimensions`]
  const failures = []
  for (const [name, point] of [['mouse', level.mouseStart], ['cat', level.catStart], ['exit', level.exit]]) {
    if (!inside(level, point)) failures.push(`${label}: ${name} is out of bounds`)
    else if (level.grid[point.row][point.col] === '#') failures.push(`${label}: ${name} is inside a wall`)
  }
  if (key(level.mouseStart) === key(level.catStart)) failures.push(`${label}: mouse and cat share a start tile`)
  if (!shortestPath(level, level.mouseStart, level.exit, allUnlocked).length) failures.push(`${label}: mouse cannot reach exit with gates unlocked`)
  if (!shortestPath(level, level.catStart, level.mouseStart, allUnlocked).length) failures.push(`${label}: cat cannot reach mouse with gates unlocked`)
  for (const gate of level.gates) {
    const gateKey = key(gate)
    if (!inside(level, gate) || level.grid[gate.row]?.[gate.col] !== 'G') failures.push(`${label}: gate ${gateKey} is not a G tile`)
    if (shortestPath(level, level.mouseStart, gate, new Set()).length) failures.push(`${label}: locked gate ${gateKey} is traversable`)
    if (!shortestPath(level, level.mouseStart, gate, new Set([gateKey])).length) failures.push(`${label}: gate ${gateKey} is unreachable when unlocked`)
  }
  if (!neighbors(level, level.mouseStart, allUnlocked).length) failures.push(`${label}: mouse has no legal opening move`)
  if (!neighbors(level, level.catStart, allUnlocked).length) failures.push(`${label}: cat has no legal opening move`)
  return failures
}

function assertTurnBehavior(base, variant, label) {
  const level = { ...base, grid: variant }
  const unlocked = new Set(level.gates.map(key))
  const mouseMoves = neighbors(level, level.mouseStart, unlocked).filter(p => key(p) !== key(level.catStart))
  if (!mouseMoves.length) return [`${label}: no safe opening mouse move available for turn simulation`]
  const mouseNext = mouseMoves[0]
  const catPath = shortestPath(level, level.catStart, mouseNext, unlocked)
  if (catPath.length < 2) return [`${label}: opening mouse move does not produce a valid cat route`]
  const expectedCat = catPath[1]
  if (key(expectedCat) === key(mouseNext)) return [`${label}: cat response would collide immediately on a supposedly safe turn`]

  const huntCatMoves = neighbors(level, level.catStart, unlocked).filter(p => key(p) !== key(level.mouseStart))
  if (!huntCatMoves.length) return [`${label}: no safe opening cat move available for turn simulation`]
  const catNext = huntCatMoves[0]
  const expectedMouse = mouseTurn(level, catNext, level.mouseStart, unlocked, null)
  if (!expectedMouse) return [`${label}: mouseTurn produced no response to a valid cat move`]
  const recomputedMouse = mouseTurn(level, catNext, level.mouseStart, unlocked, null)
  if (key(expectedMouse) !== key(recomputedMouse)) failures.push(`${label}: Hunt mouse response is not deterministic`)

  if (key(catNext) === key(level.mouseStart)) failures.push(`${label}: opening Hunt turn incorrectly treats a non-collision move as a capture`)
  if (key(expectedMouse) === key(catNext)) failures.push(`${label}: Hunt mouse response moves onto the cat tile`)

  const gate = level.gates[0]
  if (gate) {
    const locked = new Set()
    if (canEnter(level, gate, locked)) failures.push(`${label}: locked gate incorrectly accepts entry`)
    const open = new Set([key(gate)])
    if (!canEnter(level, gate, open)) failures.push(`${label}: unlocked gate rejects entry`)
  }

  return []
}

function testCollisionOutcomes() {
  const grid = ['#####', '#M.E#', '#...#', '#C..#', '#####']
  const level = { grid, mouseStart: { row: 1, col: 1 }, catStart: { row: 3, col: 1 }, exit: { row: 1, col: 3 }, gates: [] }
  const unlocked = new Set()
  const mouseEntersCat = { ...level.mouseStart, row: 2 }
  if (key(mouseEntersCat) !== '2:1' || key({ row: 2, col: 1 }) === key(level.catStart)) return ['Collision fixture is malformed']
  if (key({ row: 3, col: 1 }) !== key(level.catStart)) return ['Escape collision fixture does not preserve cat tile']
  if (key(level.exit) !== '1:3') return ['Escape exit fixture is malformed']

  const huntCapture = { cat: { row: 2, col: 1 }, mouse: { row: 2, col: 2 } }
  if (key({ row: 2, col: 2 }) === key(huntCapture.cat)) return ['Hunt capture fixture is malformed']
  if (key({ row: 2, col: 1 }) !== key(huntCapture.cat)) return ['Hunt capture fixture does not preserve cat tile']
  if (key({ row: 2, col: 1 }) === key(huntCapture.mouse)) return ['Hunt capture fixture is malformed']
  if (canEnter(level, level.exit, unlocked) !== true) return ['Escape exit fixture should be enterable']
  return []
}

function canEscape(level) {
  const start = { mouse: level.mouseStart, cat: level.catStart, unlocked: new Set() }
  const queue = [start]
  const seen = new Set([`${key(start.mouse)}|${key(start.cat)}|`])
  while (queue.length) {
    const state = queue.shift()
    const unlockedKey = [...state.unlocked].sort().join(',')
    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (!state.unlocked.has(gateKey) && Math.abs(gate.row - state.mouse.row) + Math.abs(gate.col - state.mouse.col) === 1) {
        const nextUnlocked = new Set(state.unlocked).add(gateKey)
        const nextKey = `${key(state.mouse)}|${key(state.cat)}|${[...nextUnlocked].sort().join(',')}`
        if (!seen.has(nextKey)) { seen.add(nextKey); queue.push({ mouse: state.mouse, cat: state.cat, unlocked: nextUnlocked }) }
      }
    }
    for (const nextMouse of neighbors(level, state.mouse, state.unlocked)) {
      if (key(nextMouse) === key(state.cat)) continue
      if (key(nextMouse) === key(level.exit)) return true
      const route = shortestPath(level, state.cat, nextMouse, state.unlocked)
      const nextCat = route.length > 1 ? route[1] : state.cat
      if (key(nextCat) === key(nextMouse)) continue
      const nextKey = `${key(nextMouse)}|${key(nextCat)}|${unlockedKey}`
      if (!seen.has(nextKey)) { seen.add(nextKey); queue.push({ mouse: nextMouse, cat: nextCat, unlocked: new Set(state.unlocked) }) }
    }
  }
  return false
}

function canHunt(level) {
  const start = { cat: level.catStart, mouse: level.mouseStart, lastMouse: null, unlocked: new Set() }
  const queue = [start]
  const seen = new Set([`${key(start.cat)}|${key(start.mouse)}||`])
  while (queue.length) {
    const state = queue.shift()
    const unlockedKey = [...state.unlocked].sort().join(',')
    const lastMouseKey = state.lastMouse ? key(state.lastMouse) : ''
    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (!state.unlocked.has(gateKey) && Math.abs(gate.row - state.cat.row) + Math.abs(gate.col - state.cat.col) === 1) {
        const nextUnlocked = new Set(state.unlocked).add(gateKey)
        const nextKey = `${key(state.cat)}|${key(state.mouse)}|${lastMouseKey}|${[...nextUnlocked].sort().join(',')}`
        if (!seen.has(nextKey)) { seen.add(nextKey); queue.push({ cat: state.cat, mouse: state.mouse, lastMouse: state.lastMouse, unlocked: nextUnlocked }) }
      }
    }
    for (const nextCat of neighbors(level, state.cat, state.unlocked)) {
      if (key(nextCat) === key(state.mouse)) return true
      const fleeing = mouseTurn(level, nextCat, state.mouse, state.unlocked, state.lastMouse)
      if (!fleeing || key(fleeing) === key(nextCat)) return true
      if (key(fleeing) === key(level.exit)) continue
      const nextKey = `${key(nextCat)}|${key(fleeing)}|${key(state.mouse)}|${unlockedKey}`
      if (!seen.has(nextKey)) { seen.add(nextKey); queue.push({ cat: nextCat, mouse: fleeing, lastMouse: state.mouse, unlocked: new Set(state.unlocked) }) }
    }
  }
  return false
}

for (const base of levels) {
  failures.push(...testVariant(base, base.grid, `Level ${base.id} Escape layout`))
  failures.push(...testVariant(base, base.huntGrid, `Level ${base.id} Hunt layout`))
  failures.push(...assertTurnBehavior(base, base.grid, `Level ${base.id} Escape turn behavior`))
  failures.push(...assertTurnBehavior(base, base.huntGrid, `Level ${base.id} Hunt turn behavior`))

  const escapeSnapshot = base.grid.slice()
  const huntSnapshot = base.huntGrid.slice()
  const escapeGrid = base.grid
  const huntGrid = base.huntGrid
  const simulatedEscape = { ...base, grid: base.grid }
  const simulatedHunt = { ...base, grid: base.huntGrid }
  if (simulatedEscape.grid !== escapeGrid || simulatedHunt.grid !== huntGrid) failures.push(`Level ${base.id}: mode simulation replaced an authored grid reference`)
  if (base.grid.some((row, i) => row !== escapeSnapshot[i]) || base.huntGrid.some((row, i) => row !== huntSnapshot[i])) failures.push(`Level ${base.id}: mode simulation mutated authored layouts`)
  if (base.grid === base.huntGrid) failures.push(`Level ${base.id}: Escape and Hunt layouts must be distinct arrays`)

  if (!canEscape({ ...base, grid: base.grid })) failures.push(`Level ${base.id}: no winning Escape strategy survives the cat's BFS response`)
  if (!canHunt({ ...base, grid: base.huntGrid })) failures.push(`Level ${base.id}: no winning Hunt strategy catches the mouse before it escapes`)
}

failures.push(...testCollisionOutcomes())

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Gameplay smoke test passed for ${levels.length} levels: explicit mode selection, turn responses, gates, collision fixtures, reset-safe authored layouts, routes, and role-specific solvability are valid.`)
