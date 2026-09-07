export type Point = { row: number; col: number }
export type Level = {
  id: number
  name: string
  subtitle: string
  grid: string[]
  huntGrid: string[]
  mouseStart: Point
  catStart: Point
  exit: Point
  gates: Point[]
  riddles: Riddle[]
}
export type Riddle = { id: string; question: string; choices: string[]; answer: number; explanation: string }
export type Direction = Point

type Mode = 'escape' | 'hunt'

const riddle = (id: string, question: string, choices: string[], answer: number, explanation: string): Riddle => ({ id, question, choices, answer, explanation })

export const levels: Level[] = [
  {
    id: 1, name: 'The First Escape', subtitle: 'Every step gives the hunter a step.',
    grid: ['###############','#M....#.......#','#.###.#.#####.#','#...#...#.....#','###.#####.###.#','#...G...#...#.#','#.#####.#.#.#.#','#.#.....#.#...#','#.#.#########.#','#...#.........#','###.#.#########','#...#.........#','#.###.#########','#.....C......E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:6}, exit:{row:13,col:13}, gates:[{row:5,col:4}],
    riddles:[riddle('gate-1','I have keys but no locks. I have space but no room. You can enter, but you cannot go outside. What am I?',['A keyboard','A house','A map','A piano'],0,'A keyboard has keys, a space bar, and an Enter key.')],
    huntGrid: ['###############','#M....#.......#','#.###.#.#####.#','#...#...#.....#','###.#####.###.#','#...G...#...#.#','#.#####.#.#.#.#','#.#.....#.#...#','#.#.###.#####.#','#...#.........#','###.#.#########','#...#.........#','#.###.#########','#C...........E#','###############'],
  },
  {
    id: 2, name: 'The Long Way Around', subtitle: 'One gate. One hunter. No wasted turns.',
    grid: ['###############','#M....#.......#','#.###.#.#####.#','#...#.#.......#','#.###.#####.###','#...G.....#...#','#####.###.#.#.#','#.....#...#.#.#','#.###.#.###.#.#','#...#.#.....#.#','###.#.#######.#','#...#.........#','#.###########.#','#C...........E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:1}, exit:{row:13,col:13}, gates:[{row:5,col:4}],
    riddles:[riddle('gate-2','What gets wetter the more it dries?',['A towel','A cloud','A sponge','Rain'],0,'A towel gets wetter as it dries you.')],
    huntGrid: ['###############','#M....#.......#','#.###.#.#####.#','#...#.#.......#','#.###.#####.###','#...G.....#...#','#####.#.#.#.#.#','#.....#...#.#.#','#.###.#.###.#.#','#...#.#.....#.#','###.#.#######.#','#...#.........#','#.###########.#','#C...........E#','###############'],
  },
  {
    id: 3, name: 'The Final Door', subtitle: 'The shortest path is not always the safest one.',
    grid: ['###############','#M.......#....#','#.#####..#.##.#','#.....#..#....#','###.#.#######.#','#...#...G.....#','#.#####.#####.#','#.......#.....#','#######.#.###.#','#.......#.#...#','#.#######.#.#.#','#.....G...#.#.#','#.#########.#.#','#C.........#.E#','###############'],
    mouseStart:{row:1,col:1}, catStart:{row:13,col:1}, exit:{row:13,col:13}, gates:[{row:5,col:8},{row:11,col:6}],
    riddles:[
      riddle('gate-3a','I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',['An echo','A tree','A bell','A shadow'],0,'An echo speaks back without having a body.'),
      riddle('gate-3b','The more you take, the more you leave behind. What are they?',['Photographs','Footsteps','Coins','Secrets'],1,'Every step you take leaves another footprint behind.'),
    ],
    huntGrid: ['###############','#M.......#....#','#.#####..#.##.#','#.....#..#....#','###.#.##.####.#','#...#...G.....#','#.#####..####.#','#.............#','#######.#.###.#','#.......#.#...#','#.#######.#.#.#','#.....G...#.#.#','#.#########.#.#','#C.........#.E#','###############'],
  },
]

export function gridForMode(level: Level, mode: Mode): string[] {
  return mode === 'hunt' ? level.huntGrid : level.grid
}

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

export function directionFrom(from: Point, to: Point): Direction | null {
  const direction = { row: to.row - from.row, col: to.col - from.col }
  return Math.abs(direction.row) + Math.abs(direction.col) === 1 ? direction : null
}

export function hasLineOfSight(grid: string[], observer: Point, target: Point, _facing: Direction | null, unlocked: Set<string>): boolean {
  if (same(observer, target)) return false

  const delta = { row: target.row - observer.row, col: target.col - observer.col }
  const sameRow = delta.row === 0
  const sameColumn = delta.col === 0
  // Hunt vision is omnidirectional: the mouse can see equally far forward,
  // backward, left, or right. It does not need to be facing the cat.
  if (!sameRow && !sameColumn) return false

  const distance = Math.abs(delta.row) + Math.abs(delta.col)
  const step = {
    row: Math.sign(delta.row),
    col: Math.sign(delta.col),
  }
  for (let currentDistance = 1; currentDistance < distance; currentDistance += 1) {
    const point = {
      row: observer.row + step.row * currentDistance,
      col: observer.col + step.col * currentDistance,
    }
    if (!canEnter(grid, point, unlocked)) return false
  }

  return canEnter(grid, target, unlocked)
}

export function chooseMouseMove(
  grid: string[],
  mouse: Point,
  cat: Point,
  exit: Point,
  unlocked: Set<string>,
  facing: Direction | null,
  previousMouse: Point | null,
): Point | null {
  const options = neighbors(grid, mouse, unlocked).filter(point => !same(point, cat))
  if (!options.length) return null

  const detected = hasLineOfSight(grid, mouse, cat, facing, unlocked)
  const previousKey = previousMouse ? key(previousMouse) : null
  const forwardPath = shortestPath(grid, mouse, exit, unlocked)
  const pathStep = forwardPath.length > 1 ? forwardPath[1] : null

  if (!detected && pathStep && options.some(option => same(option, pathStep))) {
    const alternatives = options.filter(option => !same(option, previousMouse ?? mouse))
    if (alternatives.some(option => same(option, pathStep)) || alternatives.length === 0) return pathStep
  }

  let best = options[0]
  let bestScore = -Infinity
  for (const option of options) {
    const exitPath = shortestPath(grid, option, exit, unlocked)
    const exitDistance = exitPath.length ? exitPath.length - 1 : 999
    const catPath = shortestPath(grid, cat, option, unlocked)
    const catDistance = catPath.length ? catPath.length - 1 : 999
    const mobility = neighbors(grid, option, unlocked).filter(next => !same(next, cat)).length
    const reversePenalty = previousKey === key(option) ? 14 : 0
    const optionFacing = directionFrom(mouse, option)
    const stillVisible = hasLineOfSight(grid, option, cat, optionFacing, unlocked)

    if (!detected) {
      const score = -exitDistance * 20 + mobility * 3 - reversePenalty * 3 - (stillVisible ? 8 : 0)
      if (score > bestScore) { bestScore = score; best = option }
    } else {
      const score = catDistance * 16 - exitDistance * 2 + mobility * 4 - reversePenalty * 4 - (stillVisible ? 20 : 0)
      if (score > bestScore) { bestScore = score; best = option }
    }
  }
  return best
}

export function validateLevels(source = levels): string[] {
  const errors: string[] = []
  const seenLevelIds = new Set<number>()

  source.forEach(level => {
    if (seenLevelIds.has(level.id)) errors.push(`Level ${level.id}: duplicate level id`)
    seenLevelIds.add(level.id)

    const variants: Array<[string, string[]]> = [['Escape', level.grid], ['Hunt', level.huntGrid]]
    for (const [variantName, grid] of variants) {
      const width = grid[0]?.length ?? 0
      if (!grid.length || !width) { errors.push(`Level ${level.id} ${variantName}: empty grid`); continue }
      if (grid.some(row => row.length !== width)) errors.push(`Level ${level.id} ${variantName}: inconsistent row width`)

      const allowedCells = new Set(['#', '.', 'M', 'C', 'E', 'G'])
      const invalidCells = new Set<string>()
      grid.forEach(row => [...row].forEach(cell => { if (!allowedCells.has(cell)) invalidCells.add(cell) }))
      if (invalidCells.size) errors.push(`Level ${level.id} ${variantName}: invalid grid cell(s) ${[...invalidCells].join(', ')}`)

      const markerCounts = { M: 0, C: 0, E: 0, G: 0 }
      grid.forEach(row => [...row].forEach(cell => {
        if (cell === 'M') markerCounts.M++
        if (cell === 'C') markerCounts.C++
        if (cell === 'E') markerCounts.E++
        if (cell === 'G') markerCounts.G++
      }))
      if (markerCounts.M !== 1) errors.push(`Level ${level.id} ${variantName}: expected exactly one M marker, found ${markerCounts.M}`)
      if (markerCounts.C !== 1) errors.push(`Level ${level.id} ${variantName}: expected exactly one C marker, found ${markerCounts.C}`)
      if (markerCounts.E !== 1) errors.push(`Level ${level.id} ${variantName}: expected exactly one E marker, found ${markerCounts.E}`)
      if (markerCounts.G !== level.gates.length) errors.push(`Level ${level.id} ${variantName}: grid/gate count mismatch`)

      const points = [level.mouseStart, level.catStart, level.exit]
      if (points.some(p => !inBounds(grid, p))) errors.push(`Level ${level.id} ${variantName}: start or exit is out of bounds`)
      if (grid[level.mouseStart.row]?.[level.mouseStart.col] !== 'M') errors.push(`Level ${level.id} ${variantName}: mouseStart is not M`)
      if (grid[level.catStart.row]?.[level.catStart.col] !== 'C') errors.push(`Level ${level.id} ${variantName}: catStart is not C`)
      if (grid[level.exit.row]?.[level.exit.col] !== 'E') errors.push(`Level ${level.id} ${variantName}: exit is not E`)
      for (const gate of level.gates) {
        const gateKey = key(gate)
        if (!inBounds(grid, gate) || grid[gate.row][gate.col] !== 'G') errors.push(`Level ${level.id} ${variantName}: gate ${gateKey} is not marked G`)
      }
      const allUnlocked = new Set(level.gates.map(key))
      if (shortestPath(grid, level.mouseStart, level.exit, allUnlocked).length === 0) errors.push(`Level ${level.id} ${variantName}: exit is unreachable with gates open`)
    }

    if (level.gates.length !== level.riddles.length) errors.push(`Level ${level.id}: gate/riddle count mismatch`)
    const seenGates = new Set<string>()
    for (const gate of level.gates) {
      const gateKey = key(gate)
      if (seenGates.has(gateKey)) errors.push(`Level ${level.id}: duplicate gate ${gateKey}`)
      seenGates.add(gateKey)
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
  })
  return errors
}
