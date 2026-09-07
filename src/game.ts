export type Point = { row: number; col: number }
export type Level = {
  id: number
  name: string
  subtitle: string
  grid: string[]
  mouseStart: Point
  catStart: Point
  exit: Point
  gates: Point[]
  riddles: Riddle[]
}
export type Riddle = { id: string; question: string; choices: string[]; answer: number; explanation: string }

const riddle = (id: string, question: string, choices: string[], answer: number, explanation: string): Riddle => ({ id, question, choices, answer, explanation })

export const levels: Level[] = [
  {
    id: 1, name: 'The First Escape', subtitle: 'Every step gives the hunter a step.',
    grid: ['###############','#M....#.......#','#.###.#.#####.#','#...#...#.....#','###.#####.###.#','#...G...#...#.#','#.#####.#.#.#.#','#.#.....#.#...#','#.#.#########.#','#...#.........#','###.#.#########','#...#.........#','#.###.#########','#.....C......E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:6}, exit:{row:13,col:13}, gates:[{row:5,col:4}],
    riddles:[riddle('gate-1','I have keys but no locks. I have space but no room. You can enter, but you cannot go outside. What am I?',['A keyboard','A house','A map','A piano'],0,'A keyboard has keys, a space bar, and an Enter key.')],
  },
  {
    id: 2, name: 'The Long Way Around', subtitle: 'One gate. One hunter. No wasted turns.',
    grid: ['###############','#M....#.......#','#.###.#.#####.#','#...#.#.......#','#.###.#####.###','#...G.....#...#','#####.###.#.#.#','#.....#...#.#.#','#.###.#.###.#.#','#...#.#.....#.#','###.#.#######.#','#...#.........#','#.###########.#','#C...........E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:1}, exit:{row:13,col:13}, gates:[{row:5,col:4}],
    riddles:[riddle('gate-2','What gets wetter the more it dries?',['A towel','A cloud','A sponge','Rain'],0,'A towel gets wetter as it dries you.')],
  },
  {
    id: 3, name: 'The Final Door', subtitle: 'The shortest path is not always the safest one.',
    grid: ['###############','#M.......#....#','#.#####..#.##.#','#.....#..#....#','###.#.#######.#','#...#...G.....#','#.#####.#####.#','#.......#.....#','#######.#.###.#','#.......#.#...#','#.#######.#.#.#','#.....G...#.#.#','#.#########.#.#','#C.........#.E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:1}, exit:{row:13,col:13}, gates:[{row:5,col:8},{row:11,col:6}],
    riddles:[
      riddle('gate-3a','I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',['An echo','A tree','A bell','A shadow'],0,'An echo speaks back without having a body.'),
      riddle('gate-3b','The more you take, the more you leave behind. What are they?',['Photographs','Footsteps','Coins','Secrets'],1,'Every step you take leaves another footprint behind.'),
    ],
  },
]

export function key(p: Point) { return `${p.row}:${p.col}` }
export function same(a: Point, b: Point) { return a.row === b.row && a.col === b.col }
export function inBounds(grid: string[], p: Point) { return grid.length > 0 && grid[0].length > 0 && p.row >= 0 && p.row < grid.length && p.col >= 0 && p.col < grid[0].length }
const directions: Point[] = [{row:-1,col:0},{row:0,col:1},{row:1,col:0},{row:0,col:-1}]
export function canEnter(grid: string[], p: Point, unlocked: Set<string>) {
  if (!inBounds(grid,p)) return false
  const cell = grid[p.row][p.col]
  return cell !== '#' && (cell !== 'G' || unlocked.has(key(p)))
}
export function shortestPath(grid: string[], from: Point, to: Point, unlocked: Set<string>) {
  if (same(from,to)) return [from]
  const queue: Point[] = [from]
  const previous = new Map<string,string|null>([[key(from),null]])
  for (let i=0;i<queue.length;i++) {
    const current=queue[i]
    for (const d of directions) {
      const next={row:current.row+d.row,col:current.col+d.col}, k=key(next)
      if (!canEnter(grid,next,unlocked)||previous.has(k)) continue
      previous.set(k,key(current))
      queue.push(next)
      if (same(next,to)) {
        const route=[next]; let parent=previous.get(k)
        while(parent){const [row,col]=parent.split(':').map(Number);route.unshift({row,col});parent=previous.get(parent)??null}
        return route
      }
    }
  }
  return []
}
export function neighbors(grid:string[],p:Point,unlocked:Set<string>) { return directions.map(d=>({row:p.row+d.row,col:p.col+d.col})).filter(n=>canEnter(grid,n,unlocked)) }

export function validateLevels(source = levels): string[] {
  const errors: string[] = []
  const seenLevelIds = new Set<number>()

  source.forEach(level => {
    if (seenLevelIds.has(level.id)) errors.push(`Level ${level.id}: duplicate level id`)
    seenLevelIds.add(level.id)

    const width = level.grid[0]?.length ?? 0
    if (!level.grid.length || !width) { errors.push(`Level ${level.id}: empty grid`); return }
    if (level.grid.some(row => row.length !== width)) errors.push(`Level ${level.id}: inconsistent row width`)

    const allowedCells = new Set(['#', '.', 'M', 'C', 'E', 'G'])
    const invalidCells = new Set<string>()
    level.grid.forEach(row => [...row].forEach(cell => { if (!allowedCells.has(cell)) invalidCells.add(cell) }))
    if (invalidCells.size) errors.push(`Level ${level.id}: invalid grid cell(s) ${[...invalidCells].join(', ')}`)

    const markerCounts = { M: 0, C: 0, E: 0, G: 0 }
    level.grid.forEach(row => [...row].forEach(cell => {
      if (cell === 'M') markerCounts.M++
      if (cell === 'C') markerCounts.C++
      if (cell === 'E') markerCounts.E++
      if (cell === 'G') markerCounts.G++
    }))
    if (markerCounts.M !== 1) errors.push(`Level ${level.id}: expected exactly one M marker, found ${markerCounts.M}`)
    if (markerCounts.C !== 1) errors.push(`Level ${level.id}: expected exactly one C marker, found ${markerCounts.C}`)
    if (markerCounts.E !== 1) errors.push(`Level ${level.id}: expected exactly one E marker, found ${markerCounts.E}`)
    if (markerCounts.G !== level.gates.length) errors.push(`Level ${level.id}: grid/gate count mismatch`)

    const points = [level.mouseStart, level.catStart, level.exit]
    if (points.some(p => !inBounds(level.grid, p))) errors.push(`Level ${level.id}: start or exit is out of bounds`)
    if (level.gates.length !== level.riddles.length) errors.push(`Level ${level.id}: gate/riddle count mismatch`)

    const seenGates = new Set<string>()
    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (seenGates.has(gateKey)) errors.push(`Level ${level.id}: duplicate gate ${gateKey}`)
      seenGates.add(gateKey)
      if (!inBounds(level.grid, gate) || level.grid[gate.row][gate.col] !== 'G') errors.push(`Level ${level.id}: gate ${gateKey} is not marked G`)
    }

    const seenRiddles = new Set<string>()
    level.riddles.forEach((riddleItem, index) => {
      if (seenRiddles.has(riddleItem.id)) errors.push(`Level ${level.id}: duplicate riddle id ${riddleItem.id}`)
      seenRiddles.add(riddleItem.id)
      if (!riddleItem.question.trim()) errors.push(`Level ${level.id}: riddle ${index + 1} has no question`)
      if (riddleItem.choices.length !== 4) errors.push(`Level ${level.id}: riddle ${index + 1} must have exactly 4 choices`)
      if (riddleItem.answer < 0 || riddleItem.answer >= riddleItem.choices.length) errors.push(`Level ${level.id}: riddle ${index + 1} answer is out of range`)
      if (!riddleItem.explanation.trim()) errors.push(`Level ${level.id}: riddle ${index + 1} has no explanation`)
    })

    if (level.grid[level.mouseStart.row]?.[level.mouseStart.col] !== 'M') errors.push(`Level ${level.id}: mouseStart is not M`)
    if (level.grid[level.catStart.row]?.[level.catStart.col] !== 'C') errors.push(`Level ${level.id}: catStart is not C`)
    if (level.grid[level.exit.row]?.[level.exit.col] !== 'E') errors.push(`Level ${level.id}: exit is not E`)
    if (same(level.mouseStart, level.catStart)) errors.push(`Level ${level.id}: mouse and cat share a start tile`)
    const allUnlocked = new Set(level.gates.map(key))
    if (shortestPath(level.grid, level.mouseStart, level.exit, allUnlocked).length === 0) errors.push(`Level ${level.id}: exit is unreachable with gates open`)
  })
  return errors
}
