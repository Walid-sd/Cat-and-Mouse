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
  'export function completeLevel',
  'export function coinSpawns',
  'export function coinKey',
]) {
  if (!source.includes(required)) failures.push(`Progression module is missing: ${required}`)
}

const costs = [...source.matchAll(/cost:\s*(\d+)/g)].map(match => Number(match[1]))
if (!costs.length || costs.some(cost => cost !== 0)) failures.push('All initial characters must be free in this phase.')
if (!source.includes("const PROFILE_KEY = 'cat-and-mouse-profile-v2'")) failures.push('Progression must use a versioned storage key.')
if (!source.includes('coins: profile.coins - character.cost')) failures.push('Character unlocks must deduct coins safely.')
if (!source.includes('Math.max(profile.completed[mode], levelIndex + 1)')) failures.push('Level completion must never reduce progression.')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Progression smoke test passed: free character roster, persistent profile, coin economy, character selection/unlocking, level completion, and deterministic coin spawning are defined.')
