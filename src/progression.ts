import type { Point } from './game'

type Mode = 'escape' | 'hunt'
type CharacterRole = 'mouse' | 'cat'

export type Character = {
  id: string
  role: CharacterRole
  name: string
  emoji: string
  description: string
  cost: number
}

export const characters: Character[] = [
  { id: 'mouse-classic', role: 'mouse', name: 'Scout', emoji: '🐭', description: 'The original escape artist.', cost: 0 },
  { id: 'mouse-snow', role: 'mouse', name: 'Snow', emoji: '🐹', description: 'A tiny explorer with a cool head.', cost: 25 },
  { id: 'mouse-shadow', role: 'mouse', name: 'Shadow', emoji: '🐁', description: 'Quiet paws, quick decisions.', cost: 50 },
  { id: 'cat-classic', role: 'cat', name: 'Hunter', emoji: '🐱', description: 'The original maze hunter.', cost: 0 },
  { id: 'cat-tiger', role: 'cat', name: 'Tiger', emoji: '🐯', description: 'Bold stripes and a sharper stare.', cost: 40 },
  { id: 'cat-black', role: 'cat', name: 'Midnight', emoji: '🐈‍⬛', description: 'A silent hunter built for dark corridors.', cost: 80 },
]

export const COIN_VALUE = 1
export const LEVEL_COMPLETION_BONUS = 10

export type PlayerProfile = {
  coins: number
  selected: Record<CharacterRole, string>
  unlocked: string[]
  completed: Record<Mode, number>
}

const PROFILE_KEY = 'cat-and-mouse-profile-v2'

const DEFAULT_PROFILE: PlayerProfile = {
  coins: 0,
  selected: { mouse: 'mouse-classic', cat: 'cat-classic' },
  unlocked: characters.filter(character => character.cost === 0).map(character => character.id),
  completed: { escape: 0, hunt: 0 },
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_PROFILE)
  const source = value as Partial<PlayerProfile>
  const validIds = new Set(characters.map(character => character.id))
  const unlocked = Array.isArray(source.unlocked)
    ? source.unlocked.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    : []
  for (const character of characters) if (character.cost === 0 && !unlocked.includes(character.id)) unlocked.push(character.id)

  const selected = {
    mouse: validIds.has(source.selected?.mouse ?? '') && characters.some(c => c.id === source.selected?.mouse && c.role === 'mouse')
      ? source.selected!.mouse!
      : DEFAULT_PROFILE.selected.mouse,
    cat: validIds.has(source.selected?.cat ?? '') && characters.some(c => c.id === source.selected?.cat && c.role === 'cat')
      ? source.selected!.cat!
      : DEFAULT_PROFILE.selected.cat,
  }

  return {
    coins: Number.isFinite(source.coins) ? Math.max(0, Math.floor(source.coins!)) : 0,
    selected,
    unlocked: [...new Set(unlocked)],
    completed: {
      escape: Math.max(0, Math.floor(Number(source.completed?.escape) || 0)),
      hunt: Math.max(0, Math.floor(Number(source.completed?.hunt) || 0)),
    },
  }
}

export function loadProfile(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): PlayerProfile {
  if (!storage) return structuredClone(DEFAULT_PROFILE)
  try { return normalizeProfile(JSON.parse(storage.getItem(PROFILE_KEY) ?? 'null')) } catch { return structuredClone(DEFAULT_PROFILE) }
}

export function saveProfile(profile: PlayerProfile, storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (!storage) return
  try { storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile))) } catch { /* persistence is optional */ }
}

export function addCoins(profile: PlayerProfile, amount: number): PlayerProfile {
  return { ...profile, coins: Math.max(0, profile.coins + Math.max(0, Math.floor(amount))) }
}

export function selectCharacter(profile: PlayerProfile, role: CharacterRole, characterId: string): PlayerProfile {
  const character = characters.find(candidate => candidate.id === characterId && candidate.role === role)
  if (!character || !profile.unlocked.includes(characterId)) return profile
  return { ...profile, selected: { ...profile.selected, [role]: characterId } }
}

export function unlockCharacter(profile: PlayerProfile, characterId: string): PlayerProfile {
  const character = characters.find(candidate => candidate.id === characterId)
  if (!character || profile.unlocked.includes(characterId) || profile.coins < character.cost) return profile
  return { ...profile, coins: profile.coins - character.cost, unlocked: [...profile.unlocked, characterId] }
}

export function completeLevel(profile: PlayerProfile, mode: Mode, levelIndex: number): PlayerProfile {
  const previousCompleted = profile.completed[mode]
  const completed = Math.max(previousCompleted, levelIndex + 1)
  if (completed === previousCompleted) return { ...profile, completed: { ...profile.completed, [mode]: completed } }
  return addCoins({ ...profile, completed: { ...profile.completed, [mode]: completed } }, LEVEL_COMPLETION_BONUS)
}

export function coinSpawns(grid: string[], seed: number, reserved: Point[]): Point[] {
  const reservedKeys = new Set(reserved.map(point => `${point.row}:${point.col}`))
  const candidates: Point[] = []
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === '.' && !reservedKeys.has(`${row}:${col}`)) candidates.push({ row, col })
    }
  }
  if (!candidates.length) return []
  const chosen: Point[] = []
  let cursor = Math.abs(seed * 17 + 11) % candidates.length
  const targetCount = Math.min(8, Math.max(4, Math.floor(candidates.length / 18)))
  while (chosen.length < targetCount && chosen.length < candidates.length) {
    const point = candidates[cursor]
    if (!chosen.some(existing => existing.row === point.row && existing.col === point.col)) chosen.push(point)
    cursor = (cursor + 7 + seed) % candidates.length
  }
  return chosen
}

export function coinKey(levelId: number, mode: Mode, point: Point): string {
  return `${levelId}:${mode}:${point.row}:${point.col}`
}

export const progressionStorageKey = PROFILE_KEY
