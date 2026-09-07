import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/progression.ts', import.meta.url), 'utf8')
const failures = []

for (const required of [
  'export const characters',
  "id: 'mouse-classic'",
  "id: 'cat-classic'",
  'export function loadProfile',
  'export function saveProfile',
  'export function addCoins',
  'export function selectCharacter',
  'export function unlockCharacter',
  'export function completeLevel',
  'export function coinSpawns',
  'export function coinKey',
]) {
  if (!source.includes(required)) failures.push(`Progression module is missing: ${required}`)
}

const costs = [...source.matchAll(/cost:\s*(\d+)/g)].map(match => Number(match[1]))
if (costs.length !== 6) failures.push('The initial roster must contain exactly six characters.')
if (costs.filter(cost => cost === 0).length !== 2) failures.push('Exactly one starter character per role must be free.')
if (!costs.some(cost => cost > 0)) failures.push('The roster must include unlockable characters.')
if (costs.some(cost => cost < 0)) failures.push('Character costs cannot be negative.')
if (!source.includes("const PROFILE_KEY = 'cat-and-mouse-profile-v2'")) failures.push('Progression must use a versioned storage key.')
if (!source.includes('coins: profile.coins - character.cost')) failures.push('Character unlocks must deduct coins safely.')
if (!source.includes('const previousCompleted = profile.completed[mode]')) failures.push('Level completion must never reduce progression or farm repeat-completion rewards.')
if (!source.includes('return addCoins({ ...profile, completed: { ...profile.completed, [mode]: completed } }, LEVEL_COMPLETION_BONUS)')) failures.push('First-time level completion must award the configured coin bonus.')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Progression smoke test passed: starter characters, unlockable character tiers, persistent profile, coin economy, character selection/unlocking, level completion, and deterministic coin spawning are defined.')
