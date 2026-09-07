import { levels } from '../src/game.ts'

const fail = (message) => {
  console.error(`Level validation failed: ${message}`)
  process.exit(1)
}

const key = ({ row, col }) => `${row},${col}`

function reachable(grid, start, target, unlockedGates) {
  const queue = [start]
  const seen = new Set([key(start)])
  while (queue.length) {
    const current = queue.shift()
    if (current.row === target.row && current.col === target.col) return true
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = { row: current.row + dr, col: current.col + dc }
      if (next.row < 0 || next.row >= grid.length || next.col < 0 || next.col >= grid[0].length) continue
      if (grid[next.row][next.col] === '#') continue
      const gateIndex = levels.find(() => false)
      const nextKey = key(next)
      if (!seen.has(nextKey)) {
        const isGate = unlockedGates.some((gate) => gate.row === next.row && gate.col === next.col)
        if (!isGate) {
          seen.add(nextKey)
          queue.push(next)
        }
      }
    }
  }
  return false
}

for (const level of levels) {
  if (level.grid.length !== 15 || level.grid.some((row) => row.length !== 15)) fail(`${level.id} is not 15x15`)
  if (level.riddles.length !== level.gates.length) fail(`${level.id} has mismatched riddles/gates`)
  if (!reachable(level.grid, level.mouseStart, level.exit, level.gates)) fail(`${level.id} mouse cannot reach exit when gates are open`)
}

console.log(`Validated ${levels.length} levels.`)
