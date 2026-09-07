export type Point = { row: number; col: number }
export type Tile = 'floor' | 'wall' | 'gate' | 'exit' | 'start' | 'cat'

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

export type Riddle = {
  id: string
  question: string
  choices: string[]
  answer: number
  explanation: string
}

export const levels: Level[] = [
  {
    id: 1,
    name: 'The First Escape',
    subtitle: 'Every step gives the hunter a step.',
    grid: [
      '###############',
      '#M....#.......#',
      '#.###.#.#####.#',
      '#...#...#.....#',
      '###.#####.###.#',
      '#...G...#...#.#',
      '#.#####.#.#.#.#',
      '#.#.....#.#...#',
      '#.#.#########.#',
      '#...#.........#',
      '###.#.#########',
      '#...#.........#',
      '#.###.#########',
      '#.....C......E#',
      '###############',
    ],
    mouseStart: { row: 1, col: 1 },
    catStart: { row: 13, col: 6 },
    exit: { row: 13, col: 14 },
    gates: [{ row: 5, col: 4 }],
    riddles: [
      {
        id: 'gate-1',
        question: 'I have keys but no locks. I have space but no room. You can enter, but you cannot go outside. What am I?',
        choices: ['A keyboard', 'A house', 'A map', 'A piano'],
        answer: 0,
        explanation: 'A keyboard has keys, a space bar, and an Enter key.'
      },
    ],
  },
]

export function key(p: Point) {
  return `${p.row}:${p.col}`
}

export function same(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col
}

export function inBounds(grid: string[], p: Point) {
  return p.row >= 0 && p.row < grid.length && p.col >= 0 && p.col < grid[0].length
}

const directions: Point[] = [
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
]

export function canEnter(grid: string[], p: Point, unlocked: Set<string>) {
  if (!inBounds(grid, p)) return false
  const cell = grid[p.row][p.col]
  if (cell === '#') return false
  if (cell === 'G' && !unlocked.has(key(p))) return false
  return true
}

/** Shortest valid route. Gates are treated as walls until their riddle is solved. */
export function shortestPath(grid: string[], from: Point, to: Point, unlocked: Set<string>) {
  if (same(from, to)) return [from]
  const queue: Point[] = [from]
  const previous = new Map<string, string | null>([[key(from), null]])
  let cursor = 0

  while (cursor < queue.length) {
    const current = queue[cursor++]
    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col }
      const nextKey = key(next)
      if (!canEnter(grid, next, unlocked) || previous.has(nextKey)) continue
      previous.set(nextKey, key(current))
      if (same(next, to)) {
        const route: Point[] = [next]
        let parent = previous.get(nextKey)
        while (parent) {
          const [row, col] = parent.split(':').map(Number)
          route.unshift({ row, col })
          parent = previous.get(parent) ?? null
        }
        return route
      }
      queue.push(next)
    }
  }
  return []
}

export function neighbors(grid: string[], p: Point, unlocked: Set<string>) {
  return directions
    .map(d => ({ row: p.row + d.row, col: p.col + d.col }))
    .filter(next => canEnter(grid, next, unlocked))
}
