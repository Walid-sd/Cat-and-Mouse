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
  const startMatch = block.match(/mouseStart:\{row:(\d+),col:(\d+)\}/)
  const exitMatch = block.match(/exit:\{row:(\d+),col:(\d+)\}/)
  const gateMatches = [...block.matchAll(/\{row:(\d+),col:(\d+)\}/g)]
  if (!gridMatch || !startMatch || !exitMatch) throw new Error(`Level ${id || index + 1}: incomplete definition`)
  const grid = [...gridMatch[1].matchAll(/'([^']*)'/g)].map(m => m[1])
  const mouseStart = { row: Number(startMatch[1]), col: Number(startMatch[2]) }
  const exit = { row: Number(exitMatch[1]), col: Number(exitMatch[2]) }
  const gateSection = block.match(/gates:\[([\s\S]*?)\],\n\s*riddles/)
  const gates = gateSection ? [...gateSection[1].matchAll(/\{row:(\d+),col:(\d+)\}/g)].map(m => ({ row: Number(m[1]), col: Number(m[2]) })) : []
  return { id, grid, mouseStart, exit, gates }
})

const directions = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }]
const key = p => `${p.row}:${p.col}`

function shortestPath(level, from, to, unlocked) {
  if (key(from) === key(to)) return [from]
  const queue = [from]
  const previous = new Map([[key(from), null]])
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col }
      if (next.row < 0 || next.row >= level.grid.length || next.col < 0 || next.col >= level.grid[0].length) continue
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

const failures = []
for (const level of levels) {
  const allUnlocked = new Set(level.gates.map(key))
  const route = shortestPath(level, level.mouseStart, level.exit, allUnlocked)
  if (!route.length) failures.push(`Level ${level.id}: mouse cannot reach exit with gates unlocked`)

  for (const gate of level.gates) {
    if (level.grid[gate.row]?.[gate.col] !== 'G') failures.push(`Level ${level.id}: gate ${key(gate)} is not a G tile`)
  }

  if (route.length && level.gates.length) {
    const routeKeys = new Set(route.map(key))
    const optional = level.gates.filter(gate => !routeKeys.has(key(gate)))
    if (optional.length) console.warn(`Level ${level.id}: ${optional.length} gate(s) are not on the shortest fully-unlocked escape route; this is allowed.`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Gameplay smoke test passed for ${levels.length} levels.`)
